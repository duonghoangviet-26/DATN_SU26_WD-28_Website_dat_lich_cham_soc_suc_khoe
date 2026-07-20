import mongoose from 'mongoose'
import {
  BacSi, LichLamViec, LichHen, NguoiDung,
  ChuyenKhoa, DichVu, HoaDon, ThanhToan,
} from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { emitDashboardRevenueChanged } from '../../realtime/socket.js'

function parseDateOnly(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function getTodayDateOnly() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

function buildSlotDateTime(dateOnly, hhmm) {
  const [hours, minutes] = String(hhmm || '').split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  const dateTime = new Date(dateOnly)
  // Tính theo giờ Việt Nam (UTC+7) nên ta lấy hours - 7 để ra giờ UTC tương ứng
  dateTime.setUTCHours(hours - 7, minutes, 0, 0)
  return dateTime
}

function isSlotInPast(dateOnly, slotStart, now = new Date()) {
  const slotDateTime = buildSlotDateTime(dateOnly, slotStart)
  return !slotDateTime || slotDateTime.getTime() <= now.getTime()
}

function formatDatePart(date) {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function nextInvoiceNumber(session, invoiceDate) {
  const datePart = formatDatePart(invoiceDate)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `so_hoa_don_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `so_hoa_don_${datePart}` },
    },
    { upsert: true, returnDocument: 'after', session }
  )
  const seq = String((counter?.value ?? counter).seq).padStart(4, '0')
  return `HD-${datePart}-${seq}`
}

async function nextAppointmentCode(session, appointmentDate) {
  const datePart = formatDatePart(appointmentDate)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `ma_lich_hen_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `ma_lich_hen_${datePart}` },
    },
    { upsert: true, returnDocument: 'after', session }
  )
  const seq = String((counter?.value ?? counter).seq).padStart(4, '0')
  return `LH-${datePart}-${seq}`
}

export async function getSpecialties(req, res) {
  try {
    const specialties = await ChuyenKhoa.find({ status: 'active' }).sort({ thu_tu: 1, ten: 1 }).select('ten mo_ta icon_url slug').lean()
    return ok(res, specialties.map((s) => ({ id: s._id, ...s })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getServices(req, res) {
  try {
    const services = await DichVu.find({ loai: 'home', status: 'active' }).populate('specialty_id', 'ten').sort({ ten: 1 }).lean()
    return ok(res, services.map((s) => ({
      id: s._id, ten: s.ten, gia: s.gia, mo_ta: s.mo_ta, mo_ta_ngan: s.mo_ta_ngan,
      thoi_gian_phut: s.thoi_gian_phut, khu_vuc: s.khu_vuc, chuyen_khoa: s.specialty_id?.ten ?? null,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getDoctors(req, res) {
  try {
    const doctors = await BacSi.find({ trang_thai_duyet: 'approved', la_hien: true })
      .populate('user_id', 'ho_ten anh_dai_dien')
      .populate('specialties','ten')
      .lean()
    return ok(res, doctors.map((d) => ({
      id: d._id, ho_ten: d.user_id?.ho_ten, anh_dai_dien: d.user_id?.anh_dai_dien,
      gia_kham: d.gia_kham, tieu_su: d.tieu_su,
      specialties: (d.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten })),
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getDoctorById(req, res) {
  try {
    const doc = await BacSi.findOne({ _id: req.params.id, trang_thai_duyet: 'approved', la_hien: true })
      .populate('user_id', 'ho_ten anh_dai_dien so_dien_thoai')
      .populate('specialties','ten slug')
      .lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')
    return ok(res, {
      id: doc._id, ho_ten: doc.user_id?.ho_ten, anh_dai_dien: doc.user_id?.anh_dai_dien,
      so_dien_thoai: doc.user_id?.so_dien_thoai, gia_kham: doc.gia_kham,
      specialties: (doc.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten, slug: s.slug })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getSlots(req, res) {
  try {
    const { date } = req.query
    if (!date) return fail(res, 400, 'Tham số date là bắt buộc (YYYY-MM-DD)')
    const doc = await BacSi.findOne({ _id: req.params.id }).select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    const ngayDate = parseDateOnly(date)
    if (!ngayDate) return fail(res, 400, 'Ngay khong hop le')
    if (ngayDate.getTime() < getTodayDateOnly().getTime()) return ok(res, [])

    const schedule = await LichLamViec.findOne({
      doctor_id: doc._id,
      ngay: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!schedule) return ok(res, [])

    const slots = schedule.slots
      .filter((s) => s.status === 'active')
      .filter((s) => !isSlotInPast(ngayDate, s.gio_bat_dau))
      .map((s) => ({
        id: s._id, schedule_id: schedule._id,
        gio_bat_dau: s.gio_bat_dau, gio_ket_thuc: s.gio_ket_thuc,
      }))
    return ok(res, slots)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function createBooking(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    async function rollbackFail(statusCode, message) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, statusCode, message)
    }

    const { doctor_id, schedule_id, slot_id, ngay_kham, ten_khach, so_dien_thoai_khach, ly_do_kham, payment_method, user_id } = req.body
    if (!doctor_id || !schedule_id || !slot_id || !ngay_kham || !ten_khach || !so_dien_thoai_khach || !payment_method) {
      return rollbackFail(400, 'Thiếu thông tin bắt buộc')
    }

    let finalUserId = user_id
    if (!finalUserId && so_dien_thoai_khach) {
      const existingUser = await NguoiDung.findOne({ 
        so_dien_thoai: so_dien_thoai_khach, 
        status: 'active', 
        role: { $in: ['user', 'patient'] } 
      }).lean()
      if (existingUser) {
        finalUserId = existingUser._id
      }
    }

    const appointmentDate = parseDateOnly(ngay_kham)
    const doc = await BacSi.findOne({ _id: doctor_id }).populate('specialties', 'ten').session(session)
    if (!doc) return rollbackFail(404, 'Bác sĩ không tồn tại')

    const schedule = await LichLamViec.findOne({ _id: schedule_id, doctor_id: doc._id }).session(session)
    if (!schedule) return rollbackFail(400, 'Lịch làm việc không hợp lệ')

    const slot = schedule.slots.id(slot_id)
    if (!slot || slot.status !== 'active') return rollbackFail(409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')
    
    // Lễ tân đặt luôn nên slot booked
    const updated = await LichLamViec.findOneAndUpdate(
      { _id: schedule_id, 'slots._id': slot_id, 'slots.status': 'active' },
      { $set: { 'slots.$.status': 'booked' } },
      { new: true, session }
    )
    if (!updated) return rollbackFail(409, 'Slot đã được đặt')

    const appointmentCode = await nextAppointmentCode(session, appointmentDate)
    const gia_kham = doc.phi_kham ?? doc.gia_kham ?? 0

    const isPaid = payment_method === 'cash'
    const [appointment] = await LichHen.create([{
      doctor_id: doc._id, schedule_id, slot_id, user_id: finalUserId || null,
      chi_nhanh_id: doc.chi_nhanh_id ?? null,
      specialty_id: doc.specialties?.[0]?._id ?? null,
      ma_lich_hen: appointmentCode,
      loai_kham: 'clinic',
      ngay_kham: appointmentDate,
      gio_kham: slot.gio_bat_dau,
      phong_kham: slot.phong_kham,
      status: isPaid ? 'confirmed' : 'pending',
      payment_status: isPaid ? 'paid' : 'unpaid',
      gia_kham,
      ten_dich_vu: doc.specialties?.[0]?.ten ?? 'Khám tổng quát',
      ten_khach,
      so_dien_thoai_khach,
      ly_do_kham: ly_do_kham || null,
    }], { session })

    const invoiceDate = new Date()
    const so_hoa_don = await nextInvoiceNumber(session, invoiceDate)

    const [invoice] = await HoaDon.create([{
      appointment_id: appointment._id, so_hoa_don,
      tong_tien_kham: gia_kham,
      chi_tiet_thu_phi: [{
        loai: 'phi_kham', ten: appointment.ten_dich_vu, so_tien: gia_kham, so_luong: 1, thanh_tien: gia_kham, created_at: new Date()
      }],
      tong_thanh_toan: gia_kham,
      trang_thai_hoa_don: isPaid ? 'da_thanh_toan_du' : 'chua_thanh_toan',
    }], { session })

    const [payment] = await ThanhToan.create([{
      appointment_id: appointment._id, hoa_don_id: invoice._id,
      so_tien: gia_kham,
      loai_thanh_toan: 'phi_dat_lich',
      phuong_thuc: payment_method === 'cash' ? 'tien_mat' : 'chuyen_khoan',
      status: isPaid ? 'paid' : 'pending',
      ngay_thanh_toan: isPaid ? new Date() : null,
    }], { session })

    await session.commitTransaction()
    session.endSession()
    emitDashboardRevenueChanged({
      ngay: invoice.created_at ?? new Date(),
      so_tien: invoice.tong_thanh_toan,
      loai: 'hoa_don',
    })

    return ok(res, {
      appointment_id: appointment._id,
      payment_id: payment._id,
      qr_payload: payment_method === 'transfer' ? `FAKE_QR_FOR_RECEPTIONIST_BOOKING_${appointmentCode}` : null
    })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}
