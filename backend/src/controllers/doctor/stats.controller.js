import { BacSi, LichHen, DanhGia, LichLamViec } from '../../models/index.js'
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

// ─── GET /api/doctor/stats/today ─────────────────────────────────────────────
// Tổng quan công việc "hôm nay" cho Dashboard bác sĩ — khác getStats (tích lũy/tháng).
// y_ta_ho_tro luôn null — hệ thống chưa có module gán y tá cho ca làm việc (xem
// docs/Bác sĩ/Audit - Truong du lieu thieu va thua trong DB).
export async function getTodayOverview(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id })
      .populate('user_id', 'ho_ten')
      .populate('specialties', 'ten')
      .lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const [schedule, appointments] = await Promise.all([
      LichLamViec.findOne({ doctor_id: doc._id, ngay: { $gte: todayStart, $lt: todayEnd } }).lean(),
      LichHen.find({ doctor_id: doc._id, ngay_kham: { $gte: todayStart, $lt: todayEnd } })
        .sort({ gio_kham: 1 })
        .populate('user_id', 'ho_ten')
        .populate('member_id', 'ho_ten')
        .lean(),
    ])

    const slotsHomNay = (schedule?.slots ?? []).filter(
      (s) => s.status !== 'cancelled' && s.status !== 'expired',
    )
    const ca_lam_viec = slotsHomNay.length
      ? {
          gio_bat_dau: slotsHomNay.reduce((min, s) => (s.gio_bat_dau < min ? s.gio_bat_dau : min), slotsHomNay[0].gio_bat_dau),
          gio_ket_thuc: slotsHomNay.reduce((max, s) => (s.gio_ket_thuc > max ? s.gio_ket_thuc : max), slotsHomNay[0].gio_ket_thuc),
        }
      : null

    const phong_kham = appointments.find((a) => a.loai_kham === 'clinic' && a.phong_kham)?.phong_kham ?? null

    return ok(res, {
      ho_ten: doc.user_id?.ho_ten ?? '',
      chuyen_khoa: (doc.specialties ?? []).map((s) => s.ten).join(', ') || 'Chưa rõ',
      ca_lam_viec,
      phong_kham,
      y_ta_ho_tro: null,
      tong_lich_hen: appointments.length,
      cho_kham: appointments.filter((a) => a.status === 'confirmed').length,
      dang_kham: appointments.filter((a) => a.status === 'in_progress').length,
      hoan_thanh: appointments.filter((a) => a.status === 'completed').length,
      lich_hen_gan_nhat: appointments
        .filter((a) => a.status !== 'cancelled')
        .slice(0, 5)
        .map((a) => ({
          id: a._id,
          gio_kham: a.gio_kham,
          benh_nhan: a.member_id?.ho_ten ?? a.ten_khach ?? a.user_id?.ho_ten ?? 'Không rõ',
          ten_dich_vu: a.ten_dich_vu ?? null,
          status: a.status,
        })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
