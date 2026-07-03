import mongoose from 'mongoose'
import {
  BacSi, LichLamViec, LichHen,
  ChuyenKhoa, DichVu, GiaDinh, ThanhVien,
} from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// A5 — Đặt lịch khám (Bệnh nhân)
// Routes: /api/patient/booking
// ============================================================

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
    const services = await DichVu.find({ loai: 'home', status: 'active' })
      .populate('specialty_id', 'ten')
      .sort({ ten: 1 })
      .lean()
    return ok(res, services.map((s) => ({
      id:         s._id,
      ten:        s.ten,
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
      .select('user_id specialties gia_kham so_nam_kinh_nghiem diem_danh_gia tong_danh_gia tuoi_nhan_kham_tu tieu_su phong_kham_mac_dinh')
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

    const doc = await BacSi.findOne({ _id: req.params.id, trang_thai_duyet: 'approved' })
      .select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    const ngayDate = new Date(date)
    if (isNaN(ngayDate)) return fail(res, 400, 'Ngày không hợp lệ')

    const schedule = await LichLamViec.findOne({
      doctor_id: doc._id,
      ngay: { $gte: ngayDate, $lt: new Date(ngayDate.getTime() + 86400000) },
    }).lean()

    if (!schedule) return ok(res, [])

    const slots = schedule.slots
      .filter((s) => s.status === 'active')
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
  try {
    const {
      loai_kham, doctor_id,
      schedule_id, slot_id,
      service_id, khu_vuc, dia_chi_kham, gio_kham,
      ngay_kham, ly_do_kham,
      member_id, ten_khach, so_dien_thoai_khach, nam_sinh_khach,
    } = req.body

    if (!loai_kham)  return fail(res, 400, 'Loại khám là bắt buộc')
    if (!['clinic', 'home'].includes(loai_kham)) return fail(res, 400, 'loai_kham phải là clinic hoặc home')
    if (!ngay_kham)  return fail(res, 400, 'Ngày khám là bắt buộc')
    if (!member_id && !ten_khach) return fail(res, 400, 'Phải có member_id hoặc ten_khach')

    // clinic: bắt buộc chọn bác sĩ cụ thể. home: KHÔNG chọn bác sĩ lúc đặt —
    // đây là dịch vụ lấy mẫu xét nghiệm tại nhà, CSKH gán nhân viên sau khi thanh toán
    // (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5).
    let doc = null
    if (loai_kham === 'clinic') {
      if (!doctor_id) return fail(res, 400, 'Bác sĩ là bắt buộc')
      doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
        .populate('specialties', 'ten')
        .lean()
      if (!doc) return fail(res, 404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
    }

    // Verify member thuộc family của user
    if (member_id) {
      const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
      if (!family) return fail(res, 404, 'Chưa có nhóm gia đình')
      const member = await ThanhVien.findOne({ _id: member_id, family_id: family._id, ngay_xoa: null }).lean()
      if (!member) return fail(res, 404, 'Không tìm thấy thành viên trong gia đình')
    }

    let gia_kham, ten_dich_vu, phong_kham = null, gio_dat

    if (loai_kham === 'clinic') {
      if (!schedule_id || !slot_id) {
        return fail(res, 400, 'Khám tại phòng khám yêu cầu schedule_id và slot_id')
      }

      // Atomic claim slot để tránh double-booking
      const updated = await LichLamViec.findOneAndUpdate(
        {
          _id:                  schedule_id,
          doctor_id:            doc._id,
          'slots._id':          slot_id,
          'slots.status':       'active',
          'slots.benh_nhan_id': null,
        },
        { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': req.user.id } },
        { new: true },
      )
      if (!updated) return fail(res, 409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')

      const claimedSlot = updated.slots.id(slot_id)
      phong_kham = claimedSlot.phong_kham
      gio_dat    = claimedSlot.gio_bat_dau
      gia_kham   = doc.gia_kham
      ten_dich_vu = doc.specialties?.[0]?.ten ?? 'Khám tổng quát'

    } else {
      // home — dịch vụ lấy mẫu xét nghiệm tại nhà, không chọn bác sĩ, chọn khu vực + giờ tự do
      if (!service_id)          return fail(res, 400, 'Khám tại nhà yêu cầu service_id')
      if (!khu_vuc?.trim())     return fail(res, 400, 'Khu vực là bắt buộc')
      if (!dia_chi_kham?.trim()) return fail(res, 400, 'Địa chỉ khám là bắt buộc')
      if (!gio_kham)             return fail(res, 400, 'Giờ khám là bắt buộc')

      const service = await DichVu.findOne({ _id: service_id, loai: 'home', status: 'active' }).lean()
      if (!service) return fail(res, 404, 'Dịch vụ không tồn tại')

      if (service.khu_vuc?.length && !service.khu_vuc.includes(khu_vuc.trim())) {
        return fail(res, 400, 'Dịch vụ này không hỗ trợ khu vực đã chọn')
      }

      gia_kham    = service.gia
      ten_dich_vu = service.ten
      gio_dat     = gio_kham
    }

    // Thanh toán ngay khi đặt cho cả 2 loại — clinic auto-confirm, home giá cố định nên
    // thanh toán trước an toàn (quyết định 2026-07-02, xem spec mục 2.1/2.5). doctor_id=null
    // cho home — CSKH gán nhân viên lấy mẫu sau qua PATCH /api/admin/appointments/:id/assign-home-staff.
    const appointment = await LichHen.create({
      user_id:      req.user.id,
      member_id:    member_id    || null,
      doctor_id:    loai_kham === 'clinic' ? doc._id : null,
      schedule_id:  loai_kham === 'clinic' ? schedule_id  : null,
      slot_id:      loai_kham === 'clinic' ? slot_id      : null,
      service_id:   loai_kham === 'home'   ? service_id   : null,
      loai_kham,
      ngay_kham:    new Date(ngay_kham),
      gio_kham:     gio_dat,
      ly_do_kham:   ly_do_kham?.trim() || null,
      phong_kham:   loai_kham === 'clinic' ? phong_kham   : null,
      dia_chi_kham: loai_kham === 'home'   ? dia_chi_kham.trim() : null,
      status:         loai_kham === 'clinic' ? 'confirmed' : 'pending',
      payment_status: 'paid',
      gia_kham,
      ten_dich_vu,
      ten_khach:           ten_khach           || null,
      so_dien_thoai_khach: so_dien_thoai_khach || null,
      nam_sinh_khach:      nam_sinh_khach       || null,
    })

    return created(res, {
      id:             appointment._id,
      status:         appointment.status,
      payment_status: appointment.payment_status,
      gia_kham:       appointment.gia_kham,
      ten_dich_vu:    appointment.ten_dich_vu,
      ngay_kham:      appointment.ngay_kham,
      gio_kham:       appointment.gio_kham,
    }, loai_kham === 'clinic'
      ? 'Đặt lịch thành công, lịch hẹn đã được xác nhận'
      : 'Đặt lịch và thanh toán thành công, chúng tôi sẽ liên hệ xác nhận lịch lấy mẫu')
  } catch (err) {
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

    if (a.schedule_id && a.slot_id) {
      await LichLamViec.findOneAndUpdate(
        { _id: a.schedule_id, 'slots._id': a.slot_id },
        { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null } },
      )
    }

    a.status          = 'cancelled'
    a.ly_do_huy       = req.body.ly_do?.trim() || 'Bệnh nhân hủy lịch'
    a.payment_deadline = null
    if (a.payment_status === 'paid') a.payment_status = 'refunded'
    await a.save()

    return ok(res, { id: a._id, status: a.status, payment_status: a.payment_status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
