import mongoose from 'mongoose'
import {
  BacSi, LichLamViec, LichHen, NguoiDung,
  ChuyenKhoa, DichVu, HoaDon, ThanhToan, GiaDinh, ThanhVien
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
    return ok(res, [])
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

    const ngayDate = parseDateOnly(date)
    if (!ngayDate) return fail(res, 400, 'Ngày không hợp lệ')
    if (ngayDate.getTime() < getTodayDateOnly().getTime()) return ok(res, [])
    if (isNaN(ngayDate.getTime())) return fail(res, 400, 'Ngày không hợp lệ')

    const doctorIdParam = req.params.id

    let doctorFilter = { trang_thai_duyet: 'approved', la_hien: true }
    if (doctorIdParam && doctorIdParam !== 'all' && doctorIdParam !== 'auto' && mongoose.Types.ObjectId.isValid(doctorIdParam)) {
      doctorFilter._id = doctorIdParam
    }

    const approvedDoctors = await BacSi.find(doctorFilter).select('_id').lean()
    const approvedDocIds = approvedDoctors.map((d) => d._id)

    if (approvedDocIds.length === 0) return ok(res, [])

    const schedules = await LichLamViec.find({
      doctor_id: { $in: approvedDocIds },
      ngay: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!schedules.length) return ok(res, [])

    const scheduleDocIds = [...new Set(schedules.map((s) => s.doctor_id.toString()))]
    const bookedAppointments = await LichHen.find({
      doctor_id: { $in: scheduleDocIds },
      ngay_kham: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    }).select('doctor_id gio_kham').lean()

    const bookedMap = bookedAppointments.reduce((acc, appt) => {
      const key = `${appt.doctor_id.toString()}_${appt.gio_kham}`
      acc[key] = true
      return acc
    }, {})

    const slotMap = new Map()

    for (const schedule of schedules) {
      const activeSlots = (schedule.slots || []).filter(
        (s) => s.status === 'active' && !isSlotInPast(ngayDate, s.gio_bat_dau)
      )

      for (const slot of activeSlots) {
        const timeKey = slot.gio_bat_dau
        const docSlotKey = `${schedule.doctor_id.toString()}_${timeKey}`
        const isBooked = !!bookedMap[docSlotKey]

        if (!slotMap.has(timeKey)) {
          slotMap.set(timeKey, {
            id: slot._id.toString(), // Lấy đại diện ID
            schedule_id: schedule._id.toString(),
            gio_bat_dau: slot.gio_bat_dau,
            gio_ket_thuc: slot.gio_ket_thuc,
            phong_kham: slot.phong_kham,
            total_capacity: 0,
            booked_count: 0,
            is_full: false,
          })
        }

        const slotInfo = slotMap.get(timeKey)
        slotInfo.total_capacity += 1
        if (isBooked) {
          slotInfo.booked_count += 1
        }
      }
    }

    const availableSlots = Array.from(slotMap.values())
      .map(s => {
        s.is_full = s.booked_count >= s.total_capacity
        return s
      })
      .sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
    
    return ok(res, availableSlots)
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

    const { doctor_id, schedule_id, slot_id, ngay_kham, ten_khach, so_dien_thoai_khach, ly_do_kham, payment_method, user_id, member_id } = req.body
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
    if (!appointmentDate) return rollbackFail(400, 'Ngày khám không hợp lệ')

    // ---- HỖ TRỢ RANDOM BÁC SĨ (doctor_id === 'auto') ----
    let doc = null
    let schedule = null
    let slot = null

    if (doctor_id === 'auto' || doctor_id === 'all') {
      // 1. Dùng tạm schedule_id truyền từ frontend để tra cứu khung giờ mong muốn
      const tempSchedule = await LichLamViec.findOne({ _id: schedule_id }).lean()
      if (!tempSchedule) return rollbackFail(400, 'Khung giờ khám không tồn tại')
      const targetSlot = tempSchedule.slots.find((s) => s._id.toString() === slot_id)
      if (!targetSlot) return rollbackFail(400, 'Khung giờ khám không hợp lệ')

      const gioKhamRequest = targetSlot.gio_bat_dau

      // 2. Tìm tất cả các bác sĩ có lịch làm việc trong ngày đó và có slot active ở khung giờ đó
      const schedules = await LichLamViec.find({
        ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
        trang_thai_ngay: 'lam_viec',
        trang_thai_xac_nhan: { $ne: 'tu_choi' },
        'slots.gio_bat_dau': gioKhamRequest,
        'slots.status': 'active',
      }).lean()

      if (!schedules.length) return rollbackFail(409, 'Không còn bác sĩ nào trống lịch vào khung giờ này')

      // Lấy danh sách bác sĩ hợp lệ
      const scheduleDocIds = [...new Set(schedules.map((s) => s.doctor_id.toString()))]
      const validDoctors = await BacSi.find({
        _id: { $in: scheduleDocIds },
        trang_thai_duyet: 'approved',
        la_hien: true
      }).lean()
      const validDocIds = new Set(validDoctors.map(d => d._id.toString()))

      // 3. Loại trừ các bác sĩ đã có lịch hẹn ở khung giờ đó & chỉ lấy bác sĩ hợp lệ
      const availableSchedules = []
      for (const s of schedules) {
        if (!validDocIds.has(s.doctor_id.toString())) continue

        const hasAppointment = await LichHen.exists({
          doctor_id: s.doctor_id,
          ngay_kham: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
          gio_kham: gioKhamRequest,
          status: { $in: ['pending', 'confirmed', 'completed'] },
        })
        if (!hasAppointment) {
          availableSchedules.push(s)
        }
      }

      if (!availableSchedules.length) return rollbackFail(409, 'Tất cả các bác sĩ đều đã có lịch hẹn hoặc không hợp lệ vào khung giờ này')

      // 4. Random bác sĩ (có thể thay đổi bằng thuật toán ưu tiên)
      const randomIndex = Math.floor(Math.random() * availableSchedules.length)
      const selectedSchedule = availableSchedules[randomIndex]

      schedule = await LichLamViec.findOne({ _id: selectedSchedule._id }).session(session)
      slot = schedule.slots.find((s) => s.gio_bat_dau === gioKhamRequest)
      doc = await BacSi.findOne({ _id: selectedSchedule.doctor_id }).populate('specialties', 'ten').session(session)
    } else {
      // Chọn thủ công như cũ
      doc = await BacSi.findOne({ _id: doctor_id }).populate('specialties', 'ten').session(session)
      if (!doc) return rollbackFail(404, 'Bác sĩ không tồn tại')
      schedule = await LichLamViec.findOne({ _id: schedule_id, doctor_id: doc._id }).session(session)
      if (!schedule) return rollbackFail(400, 'Lịch làm việc không hợp lệ')
      slot = schedule.slots.id(slot_id)
    }

    if (!slot || slot.status !== 'active') return rollbackFail(409, 'Khung giờ này đã được đặt, vui lòng tải lại trang và chọn lại.')

    // Lễ tân đặt luôn nên slot booked
    const updated = await LichLamViec.findOneAndUpdate(
      { _id: schedule._id, 'slots._id': slot._id, 'slots.status': 'active' },
      { $set: { 'slots.$.status': 'booked' } },
      { new: true, session }
    )
    if (!updated) return rollbackFail(409, 'Khung giờ này vừa mới được người khác đặt. Vui lòng chọn khung giờ khác.')

    const appointmentCode = await nextAppointmentCode(session, appointmentDate)
    const gia_kham = doc.phi_kham ?? doc.gia_kham ?? 0
    
    if (gia_kham === undefined || gia_kham === null || gia_kham <= 0) {
      return rollbackFail(400, 'Bác sĩ chưa được cấu hình giá khám hợp lệ. Vui lòng kiểm tra lại cấu hình Bác sĩ.')
    }

    const isPaid = payment_method === 'cash'
    const [appointment] = await LichHen.create([{
      doctor_id: doc._id, schedule_id: schedule._id, slot_id: slot._id, user_id: finalUserId || null,
      member_id: member_id || null, // Lưu ID thành viên gia đình (nếu có)
      chi_nhanh_id: doc.chi_nhanh_id ?? null,
      specialty_id: doc.specialties?.[0]?._id ?? null,
      ma_lich_hen: appointmentCode,
      loai_kham: 'clinic',
      hinh_thuc_dat_lich: 'receptionist',
      ngay_kham: appointmentDate,
      gio_kham: slot.gio_bat_dau,
      phong_kham: slot.phong_kham,
      status: 'checked_in',
      gio_den_thuc_te: new Date(),
      payment_status: isPaid ? 'paid' : 'unpaid',
      gia_kham,
      ten_dich_vu: doc.specialties?.[0]?.ten ?? 'Khám tổng quát',
      ten_khach,
      so_dien_thoai_khach,
      ly_do_kham: ly_do_kham || null,
      hinh_thuc_dat_lich: 'receptionist',
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
      ma_giao_dich: payment.ma_giao_dich,
      so_hoa_don: invoice.so_hoa_don || appointmentCode,
      status: appointment.status,
      payment_status: payment.status,
      gia_kham: gia_kham,
      qr_payload: payment_method === 'transfer' ? `FAKE_QR_FOR_RECEPTIONIST_BOOKING_${appointmentCode}` : null
    })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/receptionist/booking/family-group/:userId ───────────────────
export async function getFamilyGroup(req, res) {
  try {
    const { userId } = req.params
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return fail(res, 400, 'ID người dùng không hợp lệ')
    }

    const family = await GiaDinh.findOne({ user_id: userId })
      .populate('members', 'ho_ten ngay_sinh gioi_tinh nhom_mau di_ung benh_nen la_chu_ho status')
      .lean()

    if (!family) {
      // Nếu chưa có nhóm, trả về người dùng hiện tại (chủ hộ ảo)
      const user = await NguoiDung.findById(userId).select('ho_ten ngay_sinh gioi_tinh').lean()
      if (!user) return fail(res, 404, 'Người dùng không tồn tại')

      return ok(res, {
        id: 'virtual-group',
        ten_nhom: 'Gia đình của ' + user.ho_ten,
        members: [{
          id: user._id,
          ho_ten: user.ho_ten,
          ngay_sinh: user.ngay_sinh,
          gioi_tinh: user.gioi_tinh || 'khac',
          la_chu_ho: true,
        }],
      })
    }

    const activeMembers = (family.members || []).filter(m => m.status === 'active')

    return ok(res, {
      id: family._id,
      ten_nhom: family.ten_nhom,
      members: activeMembers.map((m) => ({
        id: m._id,
        ho_ten: m.ho_ten,
        ngay_sinh: m.ngay_sinh,
        gioi_tinh: m.gioi_tinh,
        nhom_mau: m.nhom_mau,
        di_ung: m.di_ung,
        benh_nen: m.benh_nen,
        la_chu_ho: m.la_chu_ho,
      })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
