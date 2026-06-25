import { DanhGia, BacSi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C6 — Quản lý đánh giá & phản hồi (Admin)
// Routes: /api/admin/reviews
// ============================================================

// ─── GET /api/admin/reviews?status=&search= ─────────────────────────────────
export async function list(req, res) {
  try {
    const { status, search } = req.query
    const filter = {}
    if (status) filter.status = status

    const reviews = await DanhGia.find(filter)
      .populate('user_id',   'ho_ten')
      .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .sort({ ngay_tao: -1 })
      .lean()

    let result = reviews.map((r) => ({
      id:        r._id,
      benh_nhan: r.user_id?.ho_ten ?? 'Không rõ',
      bac_si:    r.doctor_id?.user_id?.ho_ten ?? 'Không rõ',
      so_sao:    r.so_sao,
      noi_dung:  r.noi_dung,
      status:    r.status,
      ngay_tao:  r.ngay_tao,
    }))

    if (search) {
      const kw = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.benh_nhan.toLowerCase().includes(kw) ||
          r.bac_si.toLowerCase().includes(kw) ||
          (r.noi_dung ?? '').toLowerCase().includes(kw),
      )
    }

    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reviews/:id/toggle ────────────────────────────────────
// Ẩn/hiện đánh giá + cập nhật diem_danh_gia của bác sĩ
export async function toggle(req, res) {
  try {
    const review = await DanhGia.findById(req.params.id)
    if (!review) return fail(res, 404, 'Không tìm thấy đánh giá')

    const oldStatus = review.status
    review.status = oldStatus === 'visible' ? 'hidden' : 'visible'
    await review.save()

    // Tính lại diem_danh_gia cho bác sĩ
    const visibleReviews = await DanhGia.find({
      doctor_id: review.doctor_id,
      status:    'visible',
    }).select('so_sao').lean()

    const tong = visibleReviews.length
    const diem = tong > 0
      ? visibleReviews.reduce((sum, r) => sum + r.so_sao, 0) / tong
      : 0

    await BacSi.findByIdAndUpdate(review.doctor_id, {
      diem_danh_gia: Math.round(diem * 10) / 10,
      tong_danh_gia: tong,
    })

    return ok(res, { id: review._id, status: review.status },
      `Đã ${review.status === 'hidden' ? 'ẩn' : 'hiện'} đánh giá`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
