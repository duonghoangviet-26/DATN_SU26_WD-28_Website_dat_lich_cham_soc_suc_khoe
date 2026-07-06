import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import LichLamViec from '../../models/LichLamViec.js'
import LichSuLichHen from '../../models/LichSuLichHen.js'
import BacSi from '../../models/BacSi.js'
import DichVu from '../../models/DichVu.js'
import HoaDon from '../../models/HoaDon.js'
import ThanhToan from '../../models/ThanhToan.js'
import HoanTien from '../../models/HoanTien.js'
import CaiDatThanhToan from '../../models/CaiDatThanhToan.js'
import { ok, created, fail } from '../../utils/response.js'

const ADMIN_REFUND_SETTING_KEYS = ['hoan_tien_admin_huy', 'hoan_tien_admin_huy_khan_cap']

function toDateOnly(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function formatAppointmentItem(appointment) {
  return {
    _id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    user_id: appointment.user_id?._id ?? appointment.user_id ?? null,
    service_id: appointment.service_id?._id ?? appointment.service_id ?? null,
    chi_nhanh_id: appointment.chi_nhanh_id ?? null,
    specialty_id: appointment.specialty_id ?? null,
    loai_benh_nhan: appointment.loai_benh_nhan ?? null,
    khach_vang_lai_id: appointment.khach_vang_lai_id ?? null,
    dat_ho: appointment.dat_ho ?? false,
    nguoi_dat_ho_id: appointment.nguoi_dat_ho_id ?? null,
    hinh_thuc_dat_lich: appointment.hinh_thuc_dat_lich ?? null,
    benh_nhan: appointment.ten_khach || appointment.user_id?.ho_ten || 'Khach vang lai',
    sdt_benh_nhan: appointment.so_dien_thoai_khach || appointment.user_id?.so_dien_thoai || null,
    doctor_id: appointment.doctor_id?._id ?? appointment.doctor_id ?? null,
    bac_si: appointment.doctor_id?.user_id?.ho_ten || 'Khong ro',
    chuyen_khoa: appointment.service_id?.ten || 'Kham tong quat',
    ngay_kham: formatDateOnly(appointment.ngay_kham),
    gio_kham: appointment.gio_kham,
    loai_kham: appointment.loai_kham,
    status: appointment.status,
    payment_status: appointment.payment_status,
    trang_thai_den: appointment.trang_thai_den ?? null,
    so_lan_thay_doi: appointment.so_lan_thay_doi ?? 0,
    gia_kham: appointment.gia_kham,
    dia_chi_kham: appointment.dia_chi_kham,
    ngay_cap_nhat: appointment.ngay_cap_nhat,
  }
}

async function getScheduleAndSlot(scheduleId, slotId, session) {
  const schedule = await LichLamViec.findOne({
    _id: scheduleId,
    'slots._id': slotId,
  }).session(session)

  if (!schedule) {
    throw new Error('Khong tim thay lich lam viec hoac khung gio nay')
  }

  const slot = schedule.slots.id(slotId)
  if (!slot) {
    throw new Error('Khong tim thay khung gio da chon')
  }

  return { schedule, slot }
}

async function getDoctorOrThrow(doctorId, session) {
  const doctor = await BacSi.findById(doctorId).session(session)
  if (!doctor) {
    throw new Error('Khong tim thay bac si')
  }
  if (doctor.trang_thai_duyet !== 'approved' || !doctor.la_hien) {
    throw new Error('Bac si nay hien khong nhan lich')
  }
  return doctor
}

async function getServiceOrThrow(serviceId, loaiKham, session) {
  const service = await DichVu.findById(serviceId).session(session)
  if (!service) {
    throw new Error('Khong tim thay dich vu')
  }
  if (service.status !== 'active') {
    throw new Error('Dich vu nay hien khong hoat dong')
  }
  if (service.loai !== loaiKham) {
    throw new Error('Loai kham khong khop voi dich vu da chon')
  }
  return service
}

function doctorSupportsService(doctor, serviceId) {
  return doctor.services.some((item) => String(item) === String(serviceId))
}

function formatDatePart(date) {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function nextCounterCode(session, keyPrefix, codePrefix, date) {
  const datePart = formatDatePart(date)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `${keyPrefix}_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `${keyPrefix}_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `${codePrefix}-${datePart}-${sequence}`
}

async function getAdminRefundPercent() {
  const setting = await CaiDatThanhToan.findOne({
    ten_cai_dat: { $in: ADMIN_REFUND_SETTING_KEYS },
  }).lean()

  if (!setting) {
    return 100
  }

  const percent = Number(setting.gia_tri)
  if (![0, 50, 80, 100].includes(percent)) {
    throw new Error('Cau hinh hoan tien cua Admin khong hop le')
  }

  return percent
}

async function findInvoiceAndPaymentsForAppointment(appointmentId, session) {
  const invoice = await HoaDon.findOne({ appointment_id: appointmentId }).session(session)

  if (!invoice) {
    return { invoice: null, payments: [] }
  }

  const payments = await ThanhToan.find({
    $or: [{ hoa_don_id: invoice._id }, { appointment_id: appointmentId }],
  }).session(session)

  return { invoice, payments }
}

async function syncRefundForCancelledAppointment({ appointment, lyDoHuy, adminUserId, session }) {
  const { invoice, payments } = await findInvoiceAndPaymentsForAppointment(appointment._id, session)

  if (appointment.payment_status !== 'paid') {
    for (const payment of payments) {
      if (payment.status === 'pending') {
        payment.status = 'failed'
        await payment.save({ session })
      }
    }

    return {
      oldPaymentStatus: appointment.payment_status,
      newPaymentStatus: appointment.payment_status,
    }
  }

  const paidPayments = payments.filter((payment) => payment.status === 'paid')
  if (paidPayments.length === 0) {
    throw new Error('Khong tim thay ban ghi thanh toan da thu cua lich hen')
  }

  const refundPercent = await getAdminRefundPercent()
  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const refundAmount = Math.round((totalPaid * refundPercent) / 100)

  for (const payment of paidPayments) {
    payment.status = 'refunded'
    payment.ngay_hoan_tien = new Date()
    await payment.save({ session })
  }

  const existingRefund = await HoanTien.findOne({ appointment_id: appointment._id }).session(session)
  if (existingRefund) {
    existingRefund.payment_id = paidPayments[0]._id
    existingRefund.so_tien_hoan = refundAmount
    existingRefund.so_tien_da_thu = totalPaid
    existingRefund.phi_huy = 0
    existingRefund.chinh_sach_hoan = 'Hoan tien thu cong boi admin'
    existingRefund.phan_tram_hoan = refundPercent
    existingRefund.ly_do = lyDoHuy
    existingRefund.ly_do_hoan = lyDoHuy
    existingRefund.status = 'completed'
    existingRefund.xu_ly_boi = adminUserId
    existingRefund.nguoi_xu_ly_id = adminUserId
    existingRefund.ngay_xu_ly = new Date()
    existingRefund.thoi_diem_hoan_thanh = new Date()
    await existingRefund.save({ session })
  } else {
    await HoanTien.create([{
      payment_id: paidPayments[0]._id,
      appointment_id: appointment._id,
      so_tien_hoan: refundAmount,
      so_tien_da_thu: totalPaid,
      phi_huy: 0,
      chinh_sach_hoan: 'Hoan tien thu cong boi admin',
      phan_tram_hoan: refundPercent,
      ly_do: lyDoHuy,
      ly_do_hoan: lyDoHuy,
      status: 'completed',
      xu_ly_boi: adminUserId,
      nguoi_xu_ly_id: adminUserId,
      ngay_xu_ly: new Date(),
      thoi_diem_hoan_thanh: new Date(),
    }], { session })
  }

  if (invoice) {
    invoice.trang_thai_hoa_don = 'chua_thanh_toan'
    await invoice.save({ session })
  }

  const oldPaymentStatus = appointment.payment_status
  appointment.payment_status = 'refunded'

  return {
    oldPaymentStatus,
    newPaymentStatus: appointment.payment_status,
  }
}

async function loadAppointmentForResponse(id) {
  return LichHen.findById(id)
    .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
    .populate({
      path: 'doctor_id',
      populate: { path: 'user_id', select: 'ho_ten' },
    })
    .populate('service_id', 'ten')
    .lean()
}

// GET /api/admin/appointments
// Lay danh sach lich hen voi filter
export async function getAllAppointments(req, res) {
  try {
    const {
      keyword,
      status,
      payment_status,
      loai_kham,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      doctor_id,
      chi_nhanh_id,
      specialty_id,
      ma_lich_hen,
    } = req.query

    const query = {}
    if (loai_kham) query.loai_kham = loai_kham
    if (doctor_id) query.doctor_id = doctor_id
    if (chi_nhanh_id) query.chi_nhanh_id = chi_nhanh_id
    if (specialty_id) query.specialty_id = specialty_id
    if (payment_status) query.payment_status = payment_status
    if (ma_lich_hen) query.ma_lich_hen = ma_lich_hen

    if (startDate || endDate) {
      query.ngay_kham = {}
      if (startDate) query.ngay_kham.$gte = toDateOnly(startDate)
      if (endDate) query.ngay_kham.$lte = toDateOnly(endDate)
    }

    let allAppointments = await LichHen.find(query)
      .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' },
      })
      .populate('service_id', 'ten')
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .lean()

    if (keyword) {
      const kw = keyword.toLowerCase().trim()
      allAppointments = allAppointments.filter((appointment) => {
        const tenBenhNhan = appointment.ten_khach || appointment.user_id?.ho_ten || ''
        const tenBacSi = appointment.doctor_id?.user_id?.ho_ten || ''
        const sdt = appointment.so_dien_thoai_khach || appointment.user_id?.so_dien_thoai || ''
        return (
          tenBenhNhan.toLowerCase().includes(kw) ||
          tenBacSi.toLowerCase().includes(kw) ||
          sdt.includes(kw)
        )
      })
    }

    const todayStr = formatDateOnly(new Date())

    const summary = {
      today: allAppointments.filter((appointment) => formatDateOnly(appointment.ngay_kham) === todayStr).length,
      pending: allAppointments.filter((appointment) => appointment.status === 'pending').length,
      confirmed: allAppointments.filter((appointment) => appointment.status === 'confirmed').length,
      completed: allAppointments.filter((appointment) => appointment.status === 'completed').length,
    }

    let displayAppointments = allAppointments
    if (status) {
      displayAppointments = displayAppointments.filter((appointment) => appointment.status === status)
    }

    const total = displayAppointments.length
    const pageNum = Number.parseInt(page, 10)
    const limitNum = Number.parseInt(limit, 10)
    
    // Nếu view_mode là doctor_grouped, trả về toàn bộ và gom nhóm
    if (req.query.view_mode === 'doctor_grouped') {
      const grouped = {}
      for (const app of displayAppointments) {
        const doctorName = app.doctor_id?.user_id?.ho_ten || 'Không rõ'
        const doctorId = app.doctor_id?._id ? String(app.doctor_id._id) : 'unknown'
        if (!grouped[doctorId]) {
          grouped[doctorId] = {
            doctor_id: doctorId,
            doctor_name: doctorName,
            appointments: []
          }
        }
        grouped[doctorId].appointments.push(formatAppointmentItem(app))
      }

      return res.status(200).json({
        success: true,
        data: Object.values(grouped),
        summary,
      })
    }

    const totalPages = total === 0 ? 1 : Math.ceil(total / limitNum)
    const startIndex = (pageNum - 1) * limitNum
    const endIndex = startIndex + limitNum

    const formattedData = displayAppointments
      .slice(startIndex, endIndex)
      .map(formatAppointmentItem)

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      summary,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/:id
export async function getAppointmentById(req, res) {
  try {
    const { id } = req.params
    const appointment = await loadAppointmentForResponse(id)

    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')

    return ok(res, formatAppointmentItem(appointment))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// PATCH /api/admin/appointments/:id/cancel
export async function cancelAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    const appointment = await LichHen.findById(id).session(session)

    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Khong tim thay lich hen')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'Khong the huy lich hen da hoan thanh hoac da huy')
    }

    if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== new Date(appointment.ngay_cap_nhat).getTime()) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Lịch hẹn đã bị thay đổi bởi người khác (Concurrency Conflict). Vui lòng tải lại trang.')
    }

    const oldStatus = appointment.status
    appointment.status = 'cancelled'
    appointment.ly_do_huy = req.body.ly_do_huy || 'Huy boi Admin'

    const { oldPaymentStatus, newPaymentStatus } = await syncRefundForCancelledAppointment({
      appointment,
      lyDoHuy: appointment.ly_do_huy,
      adminUserId: req.user.id,
      session,
    })

    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: oldStatus,
      den_trang_thai: 'cancelled',
      tu_payment_status: oldPaymentStatus,
      den_payment_status: newPaymentStatus,
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: appointment.ly_do_huy,
    }], { session })

    if (appointment.schedule_id && appointment.slot_id) {
      const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
      const slot = schedule?.slots.id(appointment.slot_id)
      if (slot) {
        slot.status = 'active'
        slot.benh_nhan_id = null
        slot.benh_nhan_tam_giu_id = null
        await schedule.save({ session })
      }
    }

    await session.commitTransaction()
    session.endSession()

    const updated = await loadAppointmentForResponse(id)
    return ok(res, formatAppointmentItem(updated), 'Đã hủy lịch hẹn thành công')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// PATCH /api/admin/appointments/:id/restore
export async function restoreAppointment(req, res) {
  try {
    const { id } = req.params
    const appointment = await LichHen.findById(id)

    if (!appointment) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (appointment.status !== 'cancelled') {
      return fail(res, 400, 'Chỉ có thể khôi phục lịch hẹn đã hủy')
    }

    // Chuyển lại trạng thái thành pending
    appointment.status = 'pending'
    appointment.ly_do_huy = null
    await appointment.save()

    return ok(res, null, 'Khôi phục lịch hẹn thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// DELETE /api/admin/appointments/:id
export async function deleteAppointment(req, res) {
  try {
    const { id } = req.params
    const appointment = await LichHen.findByIdAndDelete(id)

    if (!appointment) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    return ok(res, null, 'Xóa cứng lịch hẹn thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// POST /api/admin/appointments
// Admin tao lich kham thay khach hang
export async function createAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const {
      user_id,
      doctor_id,
      schedule_id,
      slot_id,
      service_id,
      loai_kham,
      dia_chi_kham,
      ly_do_kham,
      ten_khach,
      so_dien_thoai_khach,
    } = req.body

    if (!doctor_id) throw new Error('Bac si la bat buoc')
    if (!schedule_id || !slot_id) throw new Error('Lich lam viec va khung gio la bat buoc')
    if (!service_id) throw new Error('Dich vu la bat buoc')
    if (!ten_khach?.trim()) throw new Error('Ten benh nhan la bat buoc')

    const doctor = await getDoctorOrThrow(doctor_id, session)
    const service = await getServiceOrThrow(service_id, loai_kham, session)
    if (!doctorSupportsService(doctor, service._id)) {
      throw new Error('Bac si khong ho tro dich vu da chon')
    }

    const { schedule, slot } = await getScheduleAndSlot(schedule_id, slot_id, session)
    if (String(schedule.doctor_id) !== String(doctor._id)) {
      throw new Error('Lich lam viec khong thuoc bac si da chon')
    }
    if (slot.status !== 'active') {
      throw new Error('Khung gio nay da bi khoa hoac huy')
    }
    slot.status = 'booked'
    slot.benh_nhan_id = user_id || null
    slot.benh_nhan_tam_giu_id = null
    await schedule.save({ session })

    const appointmentDate = toDateOnly(schedule.ngay)
    const maLichHen = await nextCounterCode(session, 'ma_lich_hen', 'LH', appointmentDate)
    const soHoaDon = await nextCounterCode(session, 'so_hoa_don', 'HD', appointmentDate)

    const appointmentDoc = new LichHen({
      user_id: user_id || null,
      doctor_id: doctor._id,
      schedule_id: schedule._id,
      slot_id: slot._id,
      service_id: service._id,
      chi_nhanh_id: schedule.chi_nhanh_id ?? doctor.chi_nhanh_id ?? null,
      specialty_id: slot.specialty_id ?? doctor.specialties?.[0] ?? null,
      ma_lich_hen: maLichHen,
      hinh_thuc_dat_lich: 'admin',
      loai_kham,
      ngay_kham: appointmentDate,
      gio_kham: slot.gio_bat_dau,
      gia_kham: service.gia,
      dia_chi_kham,
      ly_do_kham: ly_do_kham?.trim() || null,
      ten_khach: ten_khach.trim(),
      so_dien_thoai_khach,
      status: 'confirmed',
      payment_status: 'unpaid',
    })

    await appointmentDoc.save({ session })

    await HoaDon.create([{
      appointment_id: appointmentDoc._id,
      so_hoa_don: soHoaDon,
      chi_nhanh_id: appointmentDoc.chi_nhanh_id,
      specialty_id: appointmentDoc.specialty_id,
      tong_tien_kham: service.gia,
      chi_tiet_thu_phi: [
        {
          loai: 'phi_kham',
          ten: 'Phi kham',
          so_tien: service.gia,
          so_luong: 1,
          thanh_tien: service.gia,
        },
      ],
      tong_tien_phat_sinh: 0,
      tong_thanh_toan: service.gia,
      trang_thai_hoa_don: 'chua_thanh_toan',
    }], { session })

    await LichSuLichHen.create([{
      appointment_id: appointmentDoc._id,
      tu_trang_thai: null,
      den_trang_thai: 'confirmed',
      tu_payment_status: null,
      den_payment_status: 'unpaid',
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: 'Admin dat lich thay khach',
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const createdAppointmentPayload = await loadAppointmentForResponse(appointmentDoc._id)
    return created(res, formatAppointmentItem(createdAppointmentPayload), 'Da tao lich hen thanh cong')

    const updatedSchedule = await LichLamViec.findOneAndUpdate(
      {
        _id: schedule_id,
        'slots._id': slot_id,
        'slots.so_benh_nhan_hien_tai': { $lt: slot.so_benh_nhan_toi_da }
      },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': 1 } },
      { session, new: true }
    )

    if (!updatedSchedule) {
      throw new Error('Khung giờ này vừa mới có người đặt hết chỗ, vui lòng chọn khung giờ khác')
    }

    const newAppointment = new LichHen({
      user_id: user_id || null,
      doctor_id: doctor._id,
      schedule_id: schedule._id,
      slot_id: slot._id,
      service_id: service._id,
      loai_kham,
      ngay_kham: toDateOnly(schedule.ngay),
      gio_kham: slot.gio_bat_dau,
      gia_kham: service.gia,
      dia_chi_kham,
      ly_do_kham: ly_do_kham?.trim() || null,
      ten_khach: ten_khach.trim(),
      so_dien_thoai_khach,
      status: 'confirmed',
      payment_status: 'unpaid',
    })

    await newAppointment.save({ session })

    await ThanhToan.create([{
      appointment_id: newAppointment._id,
      benh_nhan_id: user_id || null,
      so_tien: service.gia,
      status: 'pending',
    }], { session })

    await LichSuLichHen.create([{
      appointment_id: newAppointment._id,
      tu_trang_thai: null,
      den_trang_thai: 'confirmed',
      tu_payment_status: null,
      den_payment_status: 'unpaid',
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: 'Admin dat lich thay khach',
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const createdAppointment = await loadAppointmentForResponse(newAppointment._id)
    return created(res, formatAppointmentItem(createdAppointment), 'Da tao lich hen thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 400, err.message)
  }
}

// PATCH /api/admin/appointments/:id/reschedule
export async function rescheduleAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    const { doctor_id, schedule_id, slot_id } = req.body

    if (!doctor_id || !schedule_id || !slot_id) {
      throw new Error('Bac si, lich lam viec va khung gio moi la bat buoc')
    }

    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      throw new Error('Khong tim thay lich hen')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      throw new Error('Khong the doi lich hen da hoan thanh hoac da huy')
    }

    if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== new Date(appointment.ngay_cap_nhat).getTime()) {
      throw new Error('Lịch hẹn đã bị thay đổi bởi người khác (Concurrency Conflict). Vui lòng tải lại trang.')
    }

    const doctor = await getDoctorOrThrow(doctor_id, session)
    if (appointment.service_id && !doctorSupportsService(doctor, appointment.service_id)) {
      throw new Error('Bac si moi khong ho tro dich vu cua lich hen nay')
    }

    const { schedule: newSchedule, slot: newSlot } = await getScheduleAndSlot(schedule_id, slot_id, session)
    if (String(newSchedule.doctor_id) !== String(doctor._id)) {
      throw new Error('Lich lam viec moi khong thuoc bac si da chon')
    }
    if (newSlot.status !== 'active') {
      throw new Error('Khung gio moi da bi khoa')
    }
    const oldSchedule = await LichLamViec.findById(appointment.schedule_id).session(session)
    const oldSlot = oldSchedule?.slots.id(appointment.slot_id)
    if (oldSlot) {
      oldSlot.status = 'active'
      oldSlot.benh_nhan_id = null
      oldSlot.benh_nhan_tam_giu_id = null
      await oldSchedule.save({ session })
    }

    newSlot.status = 'booked'
    newSlot.benh_nhan_id = appointment.user_id ?? null
    newSlot.benh_nhan_tam_giu_id = null
    await newSchedule.save({ session })

    appointment.doctor_id = doctor._id
    appointment.schedule_id = newSchedule._id
    appointment.slot_id = newSlot._id
    appointment.chi_nhanh_id = newSchedule.chi_nhanh_id ?? doctor.chi_nhanh_id ?? appointment.chi_nhanh_id
    appointment.specialty_id = newSlot.specialty_id ?? doctor.specialties?.[0] ?? appointment.specialty_id
    appointment.ngay_kham = toDateOnly(newSchedule.ngay)
    appointment.gio_kham = newSlot.gio_bat_dau
    appointment.so_lan_thay_doi = (appointment.so_lan_thay_doi ?? 0) + 1
    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: appointment.status,
      den_trang_thai: appointment.status,
      tu_payment_status: appointment.payment_status,
      den_payment_status: appointment.payment_status,
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: `Admin doi lich sang ${newSlot.gio_bat_dau} ngay ${formatDateOnly(newSchedule.ngay)}`,
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const updatedAppointmentPayload = await loadAppointmentForResponse(appointment._id)
    return ok(res, formatAppointmentItem(updatedAppointmentPayload), 'Da doi lich thanh cong')

    if (newSlot.so_benh_nhan_hien_tai >= newSlot.so_benh_nhan_toi_da) {
      throw new Error('Khung gio moi da kin cho')
    }

    await LichLamViec.findOneAndUpdate(
      {
        _id: appointment.schedule_id,
        'slots._id': appointment.slot_id,
        'slots.so_benh_nhan_hien_tai': { $gt: 0 },
      },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': -1 } },
      { session }
    )

    const updatedNewSchedule = await LichLamViec.findOneAndUpdate(
      {
        _id: schedule_id,
        'slots._id': slot_id,
        'slots.so_benh_nhan_hien_tai': { $lt: newSlot.so_benh_nhan_toi_da }
      },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': 1 } },
      { session, new: true }
    )

    if (!updatedNewSchedule) {
      throw new Error('Khung giờ mới vừa có người đặt hết chỗ, vui lòng chọn khung giờ khác')
    }

    appointment.doctor_id = doctor._id
    appointment.schedule_id = newSchedule._id
    appointment.slot_id = newSlot._id
    appointment.ngay_kham = toDateOnly(newSchedule.ngay)
    appointment.gio_kham = newSlot.gio_bat_dau
    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: appointment.status,
      den_trang_thai: appointment.status,
      tu_payment_status: appointment.payment_status,
      den_payment_status: appointment.payment_status,
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: `Admin doi lich sang ${newSlot.gio_bat_dau} ngay ${formatDateOnly(newSchedule.ngay)}`,
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const updatedAppointment = await loadAppointmentForResponse(appointment._id)
    return ok(res, formatAppointmentItem(updatedAppointment), 'Da doi lich thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 400, err.message)
  }
}

// GET /api/admin/doctors/active
// Lay danh sach bac si (dung cho Dropdown)
export async function getActiveDoctors(req, res) {
  try {
    const doctors = await BacSi.find({ la_hien: true, trang_thai_duyet: 'approved' })
      .populate('user_id', 'ho_ten email so_dien_thoai')
      .populate('specialties', 'ten')
      .lean()

    const formatted = doctors.map((doctor) => ({
      _id: doctor._id,
      ten: doctor.user_id?.ho_ten,
      chuyen_khoa: doctor.specialties?.map((specialty) => specialty.ten).join(', ') || 'Chua ro',
      service_ids: doctor.services?.map((serviceId) => String(serviceId)) || [],
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/services/active?loai=clinic|home
export async function getActiveServices(req, res) {
  try {
    const { loai } = req.query
    const filter = { status: 'active' }
    if (loai) filter.loai = loai

    const services = await DichVu.find(filter)
      .sort({ ten: 1 })
      .lean()

    const formatted = services.map((service) => ({
      _id: service._id,
      ten: service.ten,
      loai: service.loai,
      gia: service.gia,
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/doctors/:id/schedules
// Lay lich lam viec cua bac si (tu hom nay tro di, slot chua qua gio)
export async function getDoctorSchedules(req, res) {
  try {
    const { id } = req.params

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    // Giờ hiện tại dạng "HH:MM" — để lọc slot đã qua trong ngày hôm nay
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTimeStr = `${hh}:${mm}`
    const todayStr = formatDateOnly(today)

    const schedules = await LichLamViec.find({
      doctor_id: id,
      ngay: { $gte: today },
    }).sort({ ngay: 1 }).lean()

    const formatted = schedules
      .map((schedule) => {
        const scheduleDate = formatDateOnly(schedule.ngay)
        const isToday = scheduleDate === todayStr

        return {
          _id: schedule._id,
          ngay: scheduleDate,
          slots: schedule.slots.filter((slot) => {
            if (slot.status !== 'active') return false
            // Nếu lịch hôm nay: loại slot đã bắt đầu hoặc đã qua (gio_bat_dau <= giờ hiện tại)
            if (isToday && slot.gio_bat_dau <= currentTimeStr) return false
            return true
          }),
        }
      })
      .filter((schedule) => schedule.slots.length > 0)

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/:id/history
// Xem lich su thay doi cua 1 lich hen
export async function getAppointmentHistory(req, res) {
  try {
    const { id } = req.params

    const history = await LichSuLichHen.find({ appointment_id: id })
      .populate('nguoi_thuc_hien_id', 'ho_ten email')
      .sort({ thoi_diem: -1 })
      .lean()

    const formatted = history.map((item) => ({
      _id: item._id,
      tu_trang_thai: item.tu_trang_thai,
      den_trang_thai: item.den_trang_thai,
      tu_payment_status: item.tu_payment_status,
      den_payment_status: item.den_payment_status,
      vai_tro: item.vai_tro,
      nguoi_thuc_hien: item.nguoi_thuc_hien_id ? item.nguoi_thuc_hien_id.ho_ten : (item.vai_tro === 'system' ? 'Hệ thống' : 'Khách'),
      nguoi_thuc_hien_email: item.nguoi_thuc_hien_id ? item.nguoi_thuc_hien_id.email : '',
      ly_do: item.ly_do,
      thoi_diem: item.thoi_diem,
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
