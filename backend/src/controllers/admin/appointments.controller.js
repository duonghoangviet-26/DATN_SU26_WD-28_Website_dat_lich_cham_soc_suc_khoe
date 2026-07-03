import mongoose from 'mongoose'
import { LichHen, NguoiDung, BacSi, LichLamViec, ThongBao } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C5 — Quản lý lịch hẹn toàn hệ thống (Admin)
// Routes: /api/admin/appointments
// ============================================================

async function formatAppointment(a) {
  const [user, doctor] = await Promise.all([
    NguoiDung.findById(a.user_id).select('ho_ten email').lean(),
    BacSi.findById(a.doctor_id).populate('user_id', 'ho_ten').lean(),
  ])
  return {
    id:              a._id,
    benh_nhan:       user?.ho_ten       ?? 'Không rõ',
    bac_si:          doctor?.user_id?.ho_ten ?? 'Không rõ',
    ngay_kham:       a.ngay_kham,
    gio_kham:        a.gio_kham,
    loai_kham:       a.loai_kham,
    status:          a.status,
    payment_status:  a.payment_status,
    gia_kham:        a.gia_kham,
    ten_dich_vu:     a.ten_dich_vu,
    phong_kham:      a.phong_kham,
    dia_chi_kham:    a.dia_chi_kham,
    ly_do_kham:      a.ly_do_kham,
    ly_do_huy:       a.ly_do_huy,
    payment_deadline: a.payment_deadline,
    ngay_tao:        a.ngay_tao,
  }
}

// ─── GET /api/admin/appointments?status=&payment_status=&loai_kham=&search=&from=&to= ─
export async function list(req, res) {
  try {
    const { status, payment_status, loai_kham, search, from, to } = req.query
    const filter = {}
    if (status)         filter.status         = status
    if (payment_status) filter.payment_status = payment_status
    if (loai_kham)      filter.loai_kham      = loai_kham
    if (from || to) {
      filter.ngay_kham = {}
      if (from) filter.ngay_kham.$gte = new Date(from)
      if (to)   filter.ngay_kham.$lte = new Date(to)
    }

    let userIds
    if (search) {
      const users = await NguoiDung.find({
        ho_ten: { $regex: search, $options: 'i' },
      }).select('_id').lean()
      userIds = users.map((u) => u._id)
      filter.user_id = { $in: userIds }
    }

    const appointments = await LichHen.find(filter)
      .populate('user_id',   'ho_ten')
      .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .sort({ ngay_kham: -1 })
      .lean()

    const result = appointments.map((a) => ({
      id:             a._id,
      benh_nhan:      a.user_id?.ho_ten ?? a.ten_khach ?? 'Không rõ',
      bac_si:         a.doctor_id?.user_id?.ho_ten ?? 'Không rõ',
      ngay_kham:      a.ngay_kham,
      gio_kham:       a.gio_kham,
      loai_kham:      a.loai_kham,
      status:         a.status,
      payment_status: a.payment_status,
      gia_kham:       a.gia_kham,
      ten_dich_vu:    a.ten_dich_vu,
      ngay_tao:       a.ngay_tao,
    }))
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/appointments/:id ────────────────────────────────────────
export async function getById(req, res) {
  try {
    const a = await LichHen.findById(req.params.id).lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    return ok(res, await formatAppointment(a))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/appointments/:id/cancel ───────────────────────────────
export async function cancel(req, res) {
  try {
    const { ly_do } = req.body
    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (['completed', 'cancelled'].includes(a.status)) {
      return fail(res, 409, 'Lịch hẹn không thể hủy ở trạng thái hiện tại')
    }

    a.status   = 'cancelled'
    a.ly_do_huy = ly_do?.trim() || 'Admin hủy lịch'
    a.payment_deadline = null
    if (a.payment_status === 'paid') a.payment_status = 'refunded'

    // Giải phóng slot nếu là clinic
    if (a.schedule_id && a.slot_id) {
      await LichLamViec.findOneAndUpdate(
        { _id: a.schedule_id, 'slots._id': a.slot_id },
        { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null } },
      )
    }

    await a.save()
    return ok(res, { id: a._id, status: a.status, payment_status: a.payment_status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/appointments/:id/complete ─────────────────────────────
// Admin đánh dấu lịch đã khám xong (chỉ từ 'confirmed' — không còn bước Admin "confirm"
// cho clinic nữa, xem docs/superpowers/specs/2026-07-02-clinic-auto-confirm-decision.md)
export async function complete(req, res) {
  try {
    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.status !== 'confirmed') {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận')
    }

    a.status = 'completed'
    await a.save()

    return ok(res, { id: a._id, status: a.status }, 'Đã đánh dấu hoàn thành')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/appointments/:id/assign-home-staff ───────────────────
// CSKH gán nhân viên lấy mẫu (BacSi.loai='home_staff') cho lịch home đang chờ xử lý.
// Chuyển status 'pending' → 'confirmed'. Không đổi payment_status (đã 'paid' từ lúc đặt,
// xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5).
export async function assignHomeStaff(req, res) {
  try {
    const { staff_id } = req.body
    if (!staff_id || !mongoose.Types.ObjectId.isValid(staff_id)) {
      return fail(res, 400, 'staff_id là bắt buộc và phải hợp lệ')
    }

    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.loai_kham !== 'home') return fail(res, 409, 'Chỉ gán nhân viên cho lịch khám tại nhà')
    if (a.status !== 'pending') return fail(res, 409, 'Chỉ gán nhân viên cho lịch đang chờ xử lý')

    const staff = await BacSi.findOne({
      _id: staff_id, loai: 'home_staff', trang_thai_duyet: 'approved', la_hien: true,
    }).lean()
    if (!staff) return fail(res, 404, 'Không tìm thấy nhân viên lấy mẫu hợp lệ')

    a.doctor_id = staff._id
    a.status    = 'confirmed'
    await a.save()

    return ok(res, { id: a._id, doctor_id: a.doctor_id, status: a.status }, 'Đã gán nhân viên lấy mẫu')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/appointments/:id/result ───────────────────────────────
// CSKH upload URL kết quả xét nghiệm (PDF) sau khi lab trả kết quả cho lịch home.
// Chuyển status 'confirmed' → 'completed' + gửi thông báo cho bệnh nhân
// (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5 bước 7–8).
export async function uploadHomeResult(req, res) {
  try {
    const { ket_qua_url } = req.body
    if (!ket_qua_url?.trim()) return fail(res, 400, 'ket_qua_url là bắt buộc')

    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.loai_kham !== 'home') return fail(res, 409, 'Chỉ áp dụng cho lịch khám tại nhà')
    if (a.status !== 'confirmed') {
      return fail(res, 409, 'Chỉ điền kết quả cho lịch đã xác nhận (đã lấy mẫu)')
    }

    a.ket_qua_url = ket_qua_url.trim()
    a.status      = 'completed'
    await a.save()

    // Không throw nếu tạo thông báo lỗi — không chặn luồng chính (giống pattern audit log ở services.controller.js)
    try {
      await ThongBao.create({
        user_id:      a.user_id,
        tieu_de:      'Kết quả xét nghiệm đã có',
        noi_dung:     `Kết quả xét nghiệm "${a.ten_dich_vu}" của bạn đã có. Vào xem chi tiết trong lịch hẹn.`,
        loai:         'appointment',
        related_id:   a._id,
        related_type: 'appointment',
      })
    } catch (notifyErr) {
      console.error('[notification] Gửi thông báo kết quả xét nghiệm thất bại:', notifyErr.message)
    }

    return ok(res, { id: a._id, ket_qua_url: a.ket_qua_url, status: a.status }, 'Đã lưu kết quả xét nghiệm')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
