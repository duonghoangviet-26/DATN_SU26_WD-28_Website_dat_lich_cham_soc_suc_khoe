import mongoose from 'mongoose'
import {
  BacSi, LichLamViec, LichHen,
  ChuyenKhoa, DichVu, GiaDinh, ThanhVien, HoaDon, ThanhToan, DanhGia,
} from '../../models/index.js'
import {
  cancelAppointmentWithPaymentSync,
  withOptionalTransaction,
} from '../../services/bookingPaymentState.service.js'
import { ok, created, fail } from '../../utils/response.js'

const PAYMENT_HOLD_MINUTES = Number(process.env.PAYMENT_HOLD_MINUTES || process.env.VNPAY_SESSION_MINUTES || 15)

function getPaymentDeadline(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000)
}

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
  dateTime.setUTCHours(hours, minutes, 0, 0)
  return dateTime
}

function isSlotInPast(dateOnly, slotStart, now = new Date()) {
  const slotDateTime = buildSlotDateTime(dateOnly, slotStart)
  return !slotDateTime || slotDateTime.getTime() <= now.getTime()
}

// ============================================================
// A5 — Đặt lịch khám (Bệnh nhân)
// Routes: /api/patient/booking
// ============================================================

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
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `HD-${datePart}-${sequence}`
}

async function nextAppointmentCode(session, appointmentDate) {
  const datePart = formatDatePart(appointmentDate)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `ma_lich_hen_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `ma_lich_hen_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `LH-${datePart}-${sequence}`
}

// ─── GET /api/patient/booking/specialties ───────────────────────────────────
export async function getSpecialties(req, res) {
  try {
    const specialties = await ChuyenKhoa.find({ status: 'active' })
      .sort({ thu_tu: 1, ten: 1 })
      .select('ten mo_ta icon_url slug')
      .lean()
    return ok(res, specialties.map((s) => ({ id: s._id, ...s })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/services ──────────────────────────────────────
export async function getServices(req, res) {
  try {
    const services = await DichVu.find({ status: 'active' })
      .populate('specialty_id', 'ten')
      .sort({ ten: 1 })
      .lean()
    return ok(res, services.map((s) => ({
      id:         s._id,
      ten:        s.ten,
      loai:       s.loai,
      gia:        s.gia,
      mo_ta:      s.mo_ta,
      mo_ta_ngan: s.mo_ta_ngan,
      thoi_gian_phut:        s.thoi_gian_phut,
      gio_dat_truoc_toi_thieu: s.gio_dat_truoc_toi_thieu,
      khu_vuc:    s.khu_vuc,
      chuyen_khoa: s.specialty_id?.ten ?? null,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors?specialty_id=&service_id= ─────────────
export async function getDoctors(req, res) {
  try {
    const { specialty_id, service_id } = req.query
    const filter = { trang_thai_duyet: 'approved', la_hien: true }

    if (specialty_id && mongoose.Types.ObjectId.isValid(specialty_id)) {
      filter.specialties = specialty_id
    }
    if (service_id && mongoose.Types.ObjectId.isValid(service_id)) {
      filter.services = service_id
    }

    const doctors = await BacSi.find(filter)
      .populate('user_id',    'ho_ten anh_dai_dien')
      .populate('specialties','ten')
      .select('user_id specialties gia_kham so_nam_kinh_nghiem diem_danh_gia tong_danh_gia tuoi_nhan_kham_tu tieu_su bang_cap kinh_nghiem phong_kham_mac_dinh')
      .lean()

    return ok(res, doctors.map((d) => ({
      id:                 d._id,
      ho_ten:             d.user_id?.ho_ten,
      anh_dai_dien:       d.user_id?.anh_dai_dien,
      gia_kham:           d.gia_kham,
      so_nam_kinh_nghiem: d.so_nam_kinh_nghiem,
      diem_danh_gia:      d.diem_danh_gia,
      tong_danh_gia:      d.tong_danh_gia,
      tuoi_nhan_kham_tu:  d.tuoi_nhan_kham_tu,
      tieu_su:            d.tieu_su,
      bang_cap:           d.bang_cap || '',
      kinh_nghiem:        d.kinh_nghiem || '',
      phong_kham_mac_dinh: d.phong_kham_mac_dinh,
      specialties: (d.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten })),
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id ───────────────────────────────────
export async function getDoctorById(req, res) {
  try {
    const doc = await BacSi.findOne({ _id: req.params.id, trang_thai_duyet: 'approved', la_hien: true })
      .populate('user_id',    'ho_ten anh_dai_dien so_dien_thoai')
      .populate('specialties','ten mo_ta icon_url slug')
      .populate('services',   'ten gia mo_ta_ngan khu_vuc')
      .lean()

    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    return ok(res, {
      id:                  doc._id,
      ho_ten:              doc.user_id?.ho_ten,
      anh_dai_dien:        doc.user_id?.anh_dai_dien,
      so_dien_thoai:       doc.user_id?.so_dien_thoai,
      gia_kham:            doc.gia_kham,
      so_nam_kinh_nghiem:  doc.so_nam_kinh_nghiem,
      diem_danh_gia:       doc.diem_danh_gia,
      tong_danh_gia:       doc.tong_danh_gia,
      tuoi_nhan_kham_tu:   doc.tuoi_nhan_kham_tu,
      tieu_su:             doc.tieu_su,
      bang_cap:            doc.bang_cap,
      kinh_nghiem:         doc.kinh_nghiem,
      phong_kham_mac_dinh: doc.phong_kham_mac_dinh,
      specialties: (doc.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten, slug: s.slug })),
      services:    (doc.services    ?? []).map((s) => ({ id: s._id, ten: s.ten, gia: s.gia, khu_vuc: s.khu_vuc })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id/slots?date=YYYY-MM-DD ─────────────
export async function getSlots(req, res) {
  try {
    const { date } = req.query
    if (!date) return fail(res, 400, 'Tham số date là bắt buộc (YYYY-MM-DD)')

    const doc = await BacSi.findOne({ _id: req.params.id, trang_thai_duyet: 'approved', la_hien: true })
      .select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    const ngayDate = parseDateOnly(date)
    if (!ngayDate) return fail(res, 400, 'Ngay khong hop le')
    if (ngayDate.getTime() < getTodayDateOnly().getTime()) return ok(res, [])
    if (isNaN(ngayDate)) return fail(res, 400, 'Ngày không hợp lệ')

    const schedule = await LichLamViec.findOne({
      doctor_id: doc._id,
      ngay: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!schedule) return ok(res, [])

    // Lấy các lịch hẹn hợp lệ (chưa bị hủy) của bác sĩ trong ngày này
    const bookedAppointments = await LichHen.find({
      doctor_id: doc._id,
      ngay_kham: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      status: { $ne: 'cancelled' },
    }).select('slot_id').lean()

    const bookedSlotIds = new Set(
      bookedAppointments
        .filter((app) => app.slot_id)
        .map((app) => app.slot_id.toString())
    )

    const slots = schedule.slots
      .filter((s) => s.status === 'active' && !s.benh_nhan_id && !bookedSlotIds.has(s._id.toString()))
      .filter((s) => !isSlotInPast(ngayDate, s.gio_bat_dau))
      .map((s) => ({
        id:          s._id,
        schedule_id: schedule._id,
        gio_bat_dau:  s.gio_bat_dau,
        gio_ket_thuc: s.gio_ket_thuc,
        phong_kham:   s.phong_kham,
      }))

    return ok(res, slots)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/booking ───────────────────────────────────────────────
export async function createBooking(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    async function rollbackFail(statusCode, message) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, statusCode, message)
    }

    const {
      loai_kham, doctor_id,
      schedule_id, slot_id,
      service_id, khu_vuc, dia_chi_kham, gio_kham,
      ngay_kham, ly_do_kham,
      member_id, ten_khach, so_dien_thoai_khach, nam_sinh_khach,
    } = req.body

    if (!loai_kham)  return rollbackFail(400, 'Loại khám là bắt buộc')
    if (!['clinic', 'home'].includes(loai_kham)) return rollbackFail(400, 'loai_kham phải là clinic hoặc home')
    if (!ngay_kham)  return rollbackFail(400, 'Ngày khám là bắt buộc')
    if (!member_id && !ten_khach) return rollbackFail(400, 'Phải có member_id hoặc ten_khach')

    // clinic: bắt buộc chọn bác sĩ cụ thể. home: KHÔNG chọn bác sĩ lúc đặt —
    // đây là dịch vụ lấy mẫu xét nghiệm tại nhà, CSKH gán nhân viên sau khi thanh toán
    // (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5).
    const appointmentDate = parseDateOnly(ngay_kham)
    if (!appointmentDate) return rollbackFail(400, 'Ngay kham khong hop le')

    let doc = null
    if (loai_kham === 'clinic') {
      if (!doctor_id) return rollbackFail(400, 'Bác sĩ là bắt buộc')
      doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
        .populate('specialties', 'ten')
        .session(session)
      if (!doc) return rollbackFail(404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
    }

    // Verify member thuộc family của user
    if (member_id) {
      const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
      if (!family) return rollbackFail(404, 'Chưa có nhóm gia đình')
      const member = await ThanhVien.findOne({ _id: member_id, family_id: family._id, ngay_xoa: null }).session(session).lean()
      if (!member) return rollbackFail(404, 'Không tìm thấy thành viên trong gia đình')
    }

    const paymentDeadline = getPaymentDeadline()
    let gia_kham, ten_dich_vu, phong_kham = null, gio_dat
    let chi_nhanh_id = null
    let specialty_id = null
    let paymentLineType = 'phi_kham'

    if (loai_kham === 'clinic') {
      if (!schedule_id || !slot_id) {
        return rollbackFail(400, 'Khám tại phòng khám yêu cầu schedule_id và slot_id')
      }

      // Atomic claim slot để tránh double-booking
      const scheduleForValidation = await LichLamViec.findOne({
        _id: schedule_id,
        doctor_id: doc._id,
        ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
        trang_thai_ngay: 'lam_viec',
        trang_thai_xac_nhan: { $ne: 'tu_choi' },
      }).session(session)

      if (!scheduleForValidation) {
        return rollbackFail(400, 'Lich lam viec khong hop le cho ngay kham da chon')
      }

      const slotForValidation = scheduleForValidation.slots.id(slot_id)
      if (!slotForValidation) {
        return rollbackFail(400, 'Khung gio khong thuoc lich lam viec da chon')
      }
      if (slotForValidation.status !== 'active' || slotForValidation.benh_nhan_id || slotForValidation.bi_khoa_boi_nghi_phep) {
        return rollbackFail(409, 'Slot da duoc dat, vui long chon khung gio khac')
      }
      if (isSlotInPast(appointmentDate, slotForValidation.gio_bat_dau)) {
        return rollbackFail(400, 'Khung gio da qua, vui long chon khung gio khac')
      }

      const updated = await LichLamViec.findOneAndUpdate(
        {
          _id:                  schedule_id,
          doctor_id:            doc._id,
          ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' },
          'slots._id':          slot_id,
          'slots.status':       'active',
          'slots.benh_nhan_id': null,
          'slots.bi_khoa_boi_nghi_phep': { $ne: true },
        },
        {
          $set: {
            'slots.$.status': 'pending_payment',
            'slots.$.benh_nhan_id': req.user.id,
            'slots.$.pending_expired_at': paymentDeadline,
          },
        },
        { new: true, session },
      )
      if (!updated) return rollbackFail(409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')

      const claimedSlot = updated.slots.id(slot_id)
      phong_kham = claimedSlot.phong_kham
      gio_dat    = claimedSlot.gio_bat_dau
      gia_kham   = doc.phi_kham ?? doc.gia_kham ?? 0
      ten_dich_vu = doc.specialties?.[0]?.ten ?? 'Khám tổng quát'
      chi_nhanh_id = updated.chi_nhanh_id ?? doc.chi_nhanh_id ?? null
      specialty_id = claimedSlot.specialty_id ?? doc.specialties?.[0]?._id ?? null

    } else {
      // home — dịch vụ lấy mẫu xét nghiệm tại nhà, không chọn bác sĩ, chọn khu vực + giờ tự do
      if (!service_id)          return rollbackFail(400, 'Khám tại nhà yêu cầu service_id')
      if (!khu_vuc?.trim())     return rollbackFail(400, 'Khu vực là bắt buộc')
      if (!dia_chi_kham?.trim()) return rollbackFail(400, 'Địa chỉ khám là bắt buộc')
      if (!gio_kham)             return rollbackFail(400, 'Giờ khám là bắt buộc')

      const service = await DichVu.findOne({ _id: service_id, loai: 'home', status: 'active' }).session(session).lean()
      if (!service) return rollbackFail(404, 'Dịch vụ không tồn tại')

      if (service.khu_vuc?.length && !service.khu_vuc.includes(khu_vuc.trim())) {
        return rollbackFail(400, 'Dịch vụ này không hỗ trợ khu vực đã chọn')
      }

      gia_kham    = service.gia
      ten_dich_vu = service.ten
      gio_dat     = gio_kham
      specialty_id = service.specialty_id ?? null
      paymentLineType = 'dich_vu'
    }

    const appointmentCode = await nextAppointmentCode(session, new Date(ngay_kham))

    const [appointment] = await LichHen.create([{
      user_id:      req.user.id,
      member_id:    member_id    || null,
      doctor_id:    loai_kham === 'clinic' ? doc._id : null,
      schedule_id:  loai_kham === 'clinic' ? schedule_id  : null,
      slot_id:      loai_kham === 'clinic' ? slot_id      : null,
      service_id:   loai_kham === 'home'   ? service_id   : null,
      chi_nhanh_id,
      specialty_id,
      ma_lich_hen:  appointmentCode,
      loai_kham,
      ngay_kham:    appointmentDate,
      gio_kham:     gio_dat,
      ly_do_kham:   ly_do_kham?.trim() || null,
      phong_kham:   loai_kham === 'clinic' ? phong_kham   : null,
      dia_chi_kham: loai_kham === 'home'   ? dia_chi_kham.trim() : null,
      status:         'pending',
      payment_status: 'unpaid',
      payment_deadline: paymentDeadline,
      gia_kham,
      ten_dich_vu,
      ten_khach:           ten_khach           || null,
      so_dien_thoai_khach: so_dien_thoai_khach || null,
      nam_sinh_khach:      nam_sinh_khach       || null,
    }], { session })

    const invoiceDate = appointment.ngay_tao instanceof Date ? appointment.ngay_tao : new Date()
    const so_hoa_don = await nextInvoiceNumber(session, invoiceDate)

    const [invoice] = await HoaDon.create([{
      appointment_id: appointment._id,
      so_hoa_don,
      chi_nhanh_id,
      specialty_id,
      tong_tien_kham: gia_kham,
      chi_tiet_thu_phi: [
        {
          loai: paymentLineType,
          ten: ten_dich_vu,
          so_tien: gia_kham,
          so_luong: 1,
          thanh_tien: gia_kham,
          ghi_chu: loai_kham === 'clinic' ? 'Phi dat lich online cho kham tai phong kham' : 'Phi dat lich online cho dich vu tai nha',
          created_at: new Date(),
        },
      ],
      tong_tien_phat_sinh: 0,
      tong_thanh_toan: gia_kham,
      trang_thai_hoa_don: 'chua_thanh_toan',
      ghi_chu_ke_toan: 'Tao tu luong dat lich online - cho xac nhan thanh toan',
    }], { session })

    const [payment] = await ThanhToan.create([{
      appointment_id: appointment._id,
      hoa_don_id: invoice._id,
      benh_nhan_id: req.user.id,
      so_tien: gia_kham,
      loai_thanh_toan: 'phi_dat_lich',
      phuong_thuc: req.body.phuong_thuc || 'chuyen_khoan',
      status: 'pending',
      ngay_thanh_toan: null,
      gateway_response: {
        provider: 'fake_gateway',
        created_from: 'patient_booking',
      },
    }], { session })

    await session.commitTransaction()
    session.endSession()

    return created(res, {
      id:             appointment._id,
      appointment_id: appointment._id,
      invoice_id:     invoice._id,
      payment_id:     payment._id,
      so_hoa_don:     invoice.so_hoa_don,
      ma_giao_dich:   payment.ma_giao_dich,
      status:         appointment.status,
      payment_status: appointment.payment_status,
      payment_record_status: payment.status,
      invoice_status: invoice.trang_thai_hoa_don,
      gia_kham:       appointment.gia_kham,
      ten_dich_vu:    appointment.ten_dich_vu,
      ngay_kham:      appointment.ngay_kham,
      gio_kham:       appointment.gio_kham,
    }, 'Tao lich hen thanh cong, vui long tiep tuc xac nhan thanh toan')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/patient/booking/:id/cancel ──────────────────────────────────
// pending (home chưa được BS xác nhận): hủy tự do.
// confirmed (clinic auto-confirm hoặc home đã được BS xác nhận): chỉ hủy được nếu còn >24h
// trước giờ khám — trong vòng 24h phải gọi lễ tân (spec 2026-06-27 mục 7.1/7.3).
export async function cancelBooking(req, res) {
  try {
    const a = await LichHen.findOne({ _id: req.params.id, user_id: req.user.id })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (['completed', 'cancelled'].includes(a.status)) {
      return fail(res, 409, 'Lịch hẹn không thể hủy ở trạng thái hiện tại')
    }
    if (a.status === 'confirmed') {
      const [h, m] = a.gio_kham.split(':').map(Number)
      const gioKham = new Date(a.ngay_kham)
      gioKham.setHours(h, m, 0, 0)
      if (gioKham.getTime() - Date.now() < 24 * 3600 * 1000) {
        return fail(res, 403, 'Lịch hẹn trong vòng 24 giờ tới không thể tự hủy, vui lòng liên hệ phòng khám')
      }
    }

    const reason = req.body.ly_do?.trim() || 'Benh nhan huy lich'
    const { appointment } = await withOptionalTransaction((session) =>
      cancelAppointmentWithPaymentSync({
        appointmentId: a._id,
        actorUserId: req.user.id,
        actorRole: 'user',
        channel: 'patient_cancel',
        reason,
        session,
      })
    )

    return ok(res, { id: appointment._id, status: appointment.status, payment_status: appointment.payment_status }, 'Da huy lich hen')

    /*
    a.status          = 'cancelled'
    a.ly_do_huy       = req.body.ly_do?.trim() || 'Bệnh nhân hủy lịch'
    a.payment_deadline = null
    if (a.payment_status === 'paid') a.payment_status = 'refunded'
    await a.save()
    */

    return ok(res, { id: a._id, status: a.status, payment_status: a.payment_status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id/reviews ───────────────────────────
export async function getDoctorReviews(req, res) {
  try {
    const doctorId = req.params.id
    const reviews = await DanhGia.find({ doctor_id: doctorId, status: 'visible', ngay_xoa: null })
      .populate('user_id', 'ho_ten')
      .sort({ ngay_tao: -1 })
      .lean()
    
    return ok(res, reviews.map((r) => ({
      id: r._id,
      benh_nhan: r.user_id?.ho_ten || 'Bệnh nhân ẩn danh',
      so_sao: r.so_sao,
      noi_dung: r.noi_dung,
      ngay_tao: r.ngay_tao,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/booking/doctors/:id/reviews ──────────────────────────
export async function createDoctorReview(req, res) {
  try {
    const doctorId = req.params.id
    const userId = req.user.id
    const { so_sao, noi_dung } = req.body

    if (!so_sao || so_sao < 1 || so_sao > 5) {
      return fail(res, 400, 'Số sao phải từ 1 đến 5')
    }

    // 1. Tìm lịch hẹn của người dùng này với bác sĩ này
    const appointments = await LichHen.find({
      user_id: userId,
      doctor_id: doctorId
    }).lean()

    if (appointments.length === 0) {
      return fail(res, 400, 'Bạn cần đăng ký khám với bác sĩ này trước khi viết đánh giá.')
    }

    // 2. Tìm lịch hẹn chưa được đánh giá
    let unreviewedAppointment = null
    for (const appt of appointments) {
      const existingReview = await DanhGia.findOne({ appointment_id: appt._id })
      if (!existingReview) {
        unreviewedAppointment = appt
        break
      }
    }

    if (!unreviewedAppointment) {
      return fail(res, 400, 'Bạn đã đánh giá tất cả các lịch hẹn với bác sĩ này.')
    }

    // 3. Tạo đánh giá mới
    const review = await DanhGia.create({
      appointment_id: unreviewedAppointment._id,
      user_id: userId,
      doctor_id: doctorId,
      so_sao: parseInt(so_sao),
      noi_dung: noi_dung || '',
      status: 'visible'
    })

    // 4. Cập nhật lại số sao trung bình & tổng số đánh giá của bác sĩ
    const result = await DanhGia.aggregate([
      {
        $match: {
          doctor_id: new mongoose.Types.ObjectId(doctorId),
          status: 'visible',
          ngay_xoa: null,
        },
      },
      {
        $group: {
          _id: '$doctor_id',
          trungBinhSao: { $avg: '$so_sao' },
          tongSo: { $sum: 1 },
        },
      },
    ])

    const info = result[0] || { trungBinhSao: 0, tongSo: 0 }
    const roundedRating = Math.round(info.trungBinhSao * 10) / 10

    await BacSi.updateOne(
      { _id: doctorId },
      {
        $set: {
          diem_danh_gia: roundedRating,
          tong_danh_gia: info.tongSo,
        },
      }
    )

    return ok(res, {
      id: review._id,
      so_sao: review.so_sao,
      noi_dung: review.noi_dung,
      ngay_tao: review.ngay_tao
    }, 'Đã gửi đánh giá thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
