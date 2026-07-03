import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import LichLamViec from '../../models/LichLamViec.js'
import LichSuLichHen from '../../models/LichSuLichHen.js'
import BacSi from '../../models/BacSi.js'
import DichVu from '../../models/DichVu.js'
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
    user_id: appointment.user_id?._id ?? appointment.user_id ?? null,
    service_id: appointment.service_id?._id ?? appointment.service_id ?? null,
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

async function syncRefundForCancelledAppointment({ appointment, lyDoHuy, adminUserId, session }) {
  const payment = await ThanhToan.findOne({ appointment_id: appointment._id }).session(session)

  if (appointment.payment_status !== 'paid') {
    if (payment && payment.status === 'pending') {
      payment.status = 'failed'
      await payment.save({ session })
    }

    return {
      oldPaymentStatus: appointment.payment_status,
      newPaymentStatus: appointment.payment_status,
    }
  }

  if (!payment) {
    throw new Error('Khong tim thay ban ghi thanh toan cua lich hen')
  }

  const refundPercent = await getAdminRefundPercent()
  const refundAmount = Math.round((payment.so_tien * refundPercent) / 100)

  payment.status = 'refunded'
  await payment.save({ session })

  const existingRefund = await HoanTien.findOne({ appointment_id: appointment._id }).session(session)
  if (existingRefund) {
    existingRefund.payment_id = payment._id
    existingRefund.so_tien_hoan = refundAmount
    existingRefund.phan_tram_hoan = refundPercent
    existingRefund.ly_do = lyDoHuy
    existingRefund.status = 'completed'
    existingRefund.xu_ly_boi = adminUserId
    existingRefund.ngay_xu_ly = new Date()
    await existingRefund.save({ session })
  } else {
    await HoanTien.create([{
      payment_id: payment._id,
      appointment_id: appointment._id,
      so_tien_hoan: refundAmount,
      phan_tram_hoan: refundPercent,
      ly_do: lyDoHuy,
      status: 'completed',
      xu_ly_boi: adminUserId,
      ngay_xu_ly: new Date(),
    }], { session })
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
      loai_kham,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      doctor_id,
    } = req.query

    const query = {}
    if (loai_kham) query.loai_kham = loai_kham
    if (doctor_id) query.doctor_id = doctor_id

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

    await LichLamViec.findOneAndUpdate(
      {
        _id: appointment.schedule_id,
        'slots._id': appointment.slot_id,
        'slots.so_benh_nhan_hien_tai': { $gt: 0 },
      },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': -1 } },
      { session }
    )

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
    if (slot.so_benh_nhan_hien_tai >= slot.so_benh_nhan_toi_da) {
      throw new Error('Khung gio nay da kin cho')
    }

    slot.so_benh_nhan_hien_tai += 1
    await schedule.save({ session })

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

    newSlot.so_benh_nhan_hien_tai += 1
    await newSchedule.save({ session })

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
            if (slot.so_benh_nhan_hien_tai >= slot.so_benh_nhan_toi_da) return false
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
