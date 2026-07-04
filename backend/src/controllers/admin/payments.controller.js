import { ThanhToan, LichHen, HoanTien } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C8 — Quản lý thanh toán (Admin)
// Routes: /api/admin/payments
// ============================================================

// ─── GET /api/admin/payments?status=&search=&from=&to= ──────────────────────
export async function list(req, res) {
  try {
    const { status, search, from, to } = req.query
    const filter = {}
    if (status) filter.status = status
    if (from || to) {
      filter.ngay_tao = {}
      if (from) filter.ngay_tao.$gte = new Date(from)
      if (to)   filter.ngay_tao.$lte = new Date(to)
    }
    if (search) {
      filter.$or = [
        { ma_giao_dich: { $regex: search, $options: 'i' } },
      ]
    }

    const payments = await ThanhToan.find(filter)
      .populate('benh_nhan_id', 'ho_ten')
      .populate({
        path: 'appointment_id',
        populate: { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
      })
      .sort({ ngay_tao: -1 })
      .lean()

    const result = payments.map((p) => ({
      id:            p._id,
      ma_giao_dich:  p.ma_giao_dich,
      benh_nhan:     p.benh_nhan_id?.ho_ten ?? 'Không rõ',
      bac_si:        p.appointment_id?.doctor_id?.user_id?.ho_ten ?? 'Không rõ',
      so_tien:       p.so_tien,
      phuong_thuc:   p.phuong_thuc,
      status:        p.status,
      ngay_tao:      p.ngay_tao,
    }))
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/payments/:id ────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const p = await ThanhToan.findById(req.params.id)
      .populate('benh_nhan_id', 'ho_ten email so_dien_thoai')
      .populate({
        path: 'appointment_id',
        populate: { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
      })
      .lean()
    if (!p) return fail(res, 404, 'Không tìm thấy giao dịch')

    return ok(res, {
      id:             p._id,
      ma_giao_dich:   p.ma_giao_dich,
      benh_nhan:      p.benh_nhan_id?.ho_ten,
      email:          p.benh_nhan_id?.email,
      so_dien_thoai:  p.benh_nhan_id?.so_dien_thoai,
      bac_si:         p.appointment_id?.doctor_id?.user_id?.ho_ten,
      appointment_id: p.appointment_id?._id,
      so_tien:        p.so_tien,
      phuong_thuc:    p.phuong_thuc,
      status:         p.status,
      ngay_thanh_toan: p.ngay_thanh_toan,
      ngay_tao:       p.ngay_tao,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/payments/:id/refund ───────────────────────────────────
export async function refund(req, res) {
  try {
    const { ly_do } = req.body
    const payment = await ThanhToan.findById(req.params.id)
    if (!payment) return fail(res, 404, 'Không tìm thấy giao dịch')
    if (payment.status !== 'paid') {
      return fail(res, 409, 'Chỉ hoàn tiền giao dịch đã thanh toán')
    }

    payment.status = 'refunded'
    await payment.save()

    // Cập nhật payment_status của lịch hẹn
    await LichHen.findByIdAndUpdate(payment.appointment_id, {
      payment_status: 'refunded',
    })

    // Lưu bản ghi hoàn tiền
    try {
      await HoanTien.create({
        payment_id: payment._id,
        so_tien:    payment.so_tien,
        ly_do:      ly_do?.trim() || 'Admin hoàn tiền',
        nguoi_duyet_id: req.user.id,
      })
    } catch (_) { /* Không chặn luồng chính */ }

    return ok(res, { id: payment._id, status: payment.status }, 'Đã hoàn tiền thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
