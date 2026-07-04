import { BacSi, LichHen, DanhGia } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// B5 — Thống kê & đánh giá (Bác sĩ)
// Routes: /api/doctor/stats, /api/doctor/reviews
// ============================================================

// ─── GET /api/doctor/stats ───────────────────────────────────────────────────
export async function getStats(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [tong, thangNay, completed, cancelled] = await Promise.all([
      LichHen.countDocuments({ doctor_id: doc._id }),
      LichHen.countDocuments({ doctor_id: doc._id, ngay_kham: { $gte: startOfMonth } }),
      LichHen.countDocuments({ doctor_id: doc._id, status: 'completed' }),
      LichHen.countDocuments({ doctor_id: doc._id, status: 'cancelled' }),
    ])

    // Doanh thu tháng này (lịch completed + paid)
    const doanhThuAgg = await LichHen.aggregate([
      { $match: { doctor_id: doc._id, status: 'completed', payment_status: 'paid', ngay_kham: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$gia_kham' } } },
    ])
    const doanh_thu_thang = doanhThuAgg[0]?.total ?? 0

    return ok(res, {
      tong_luot_kham:  tong,
      thang_nay:       thangNay,
      ty_le_hoan_thanh: tong > 0 ? Math.round((completed / tong) * 100) : 0,
      ty_le_huy:        tong > 0 ? Math.round((cancelled  / tong) * 100) : 0,
      diem_danh_gia:   doc.diem_danh_gia,
      so_danh_gia:     doc.tong_danh_gia,
      doanh_thu_thang,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/reviews ─────────────────────────────────────────────────
export async function getReviews(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const reviews = await DanhGia.find({ doctor_id: doc._id, status: 'visible' })
      .populate('user_id', 'ho_ten anh_dai_dien')
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, reviews.map((r) => ({
      id:        r._id,
      benh_nhan: r.user_id?.ho_ten ?? 'Ẩn danh',
      diem:      r.so_sao,
      noi_dung:  r.noi_dung,
      ngay_tao:  r.ngay_tao,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
