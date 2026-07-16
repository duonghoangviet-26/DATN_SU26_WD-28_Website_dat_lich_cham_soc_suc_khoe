import { BacSi, LichHen, DanhGia, LichLamViec } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// B5 — Thống kê & đánh giá (Bác sĩ)
// Routes: /api/doctor/stats, /api/doctor/reviews
// ============================================================

// Toàn tiến trình chạy TZ=UTC (config/timezone.js) nên `new Date(); setHours(0,0,0,0)` tính ra
// UTC-midnight của "now" theo UTC — SAI trong khung 00:00–06:59 giờ VN (UTC+7, không DST), lúc
// đó UTC vẫn còn là NGÀY HÔM TRƯỚC (vd VN 2026-07-16 03:00 = UTC 2026-07-15 20:00). Phải cộng
// bù +7h trước khi lấy Y-M-D thì mới ra đúng ngày lịch Việt Nam (khớp quy ước ngay_kham/ngay lưu
// UTC-midnight đại diện ngày VN — xem docs/Bác sĩ/Audit tong the, GAP-002).
const VN_OFFSET_MS = 7 * 3600 * 1000
function startOfTodayVN(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()))
}
function startOfMonthVN(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1))
}

// ─── GET /api/doctor/stats ───────────────────────────────────────────────────
export async function getStats(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const startOfMonth = startOfMonthVN()

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
export async function getTodayOverview(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id })
      .populate('user_id', 'ho_ten')
      .populate('specialties', 'ten')
      .lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const todayStart = startOfTodayVN()
    const todayEnd = new Date(todayStart)
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)

    const [schedule, appointments] = await Promise.all([
      LichLamViec.findOne({ doctor_id: doc._id, ngay: { $gte: todayStart, $lt: todayEnd } })
        .populate('nurse_id', 'ho_ten')
        .lean(),
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
      // Module gán y tá cho ca làm việc đã có từ Kế hoạch 1 (LichLamViec.nurse_id) — trước đây
      // hardcode null vì module chưa tồn tại, giờ trả đúng dữ liệu thật.
      y_ta_ho_tro: schedule?.nurse_id ? { id: schedule.nurse_id._id, ho_ten: schedule.nurse_id.ho_ten } : null,
      // Loại cancelled — lịch đã hủy không còn tính là "lịch hẹn hôm nay" (khớp cách
      // lich_hen_gan_nhat bên dưới đã lọc), tránh card "Tổng" trông vênh so với các card khác
      // khi có lịch bị hủy trong ngày (xem docs/Bác sĩ/Audit tong the, GAP-008).
      tong_lich_hen: appointments.filter((a) => a.status !== 'cancelled').length,
      // checked_in cũng là "chờ khám" — khớp cách đếm dang_cho_kham bên nurse/dashboard.controller.js
      cho_kham: appointments.filter((a) => ['confirmed', 'checked_in'].includes(a.status)).length,
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
