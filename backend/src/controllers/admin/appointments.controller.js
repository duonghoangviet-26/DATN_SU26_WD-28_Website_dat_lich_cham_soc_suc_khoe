import { LichHen, NguoiDung, BacSi, LichLamViec } from '../../models/index.js'
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

    // Giải phóng slot nếu là clinic
    if (a.schedule_id && a.slot_id) {
      await LichLamViec.findOneAndUpdate(
        { _id: a.schedule_id, 'slots._id': a.slot_id },
        { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null } },
      )
    }

    await a.save()
    return ok(res, { id: a._id, status: a.status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
