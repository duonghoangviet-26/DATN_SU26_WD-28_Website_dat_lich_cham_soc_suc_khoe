import { BacSi, HangDoi, NhatKyThaoTac } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

// ============================================================
// C6/D78 — Biên bản ca khẩn cuối ngày.
// ============================================================
// Dữ liệu cấp cứu KHÔNG có bảng riêng — nằm trong `NhatKyThaoTac` (hanh_dong=
// 'LT_OFFLINE_INTAKE_CENTRAL', du_lieu_moi.muc_uu_tien_tiep_nhan='cap_cuu'), được ghi kèm từ
// 2026-08-14 (xem centralOfflineQueue.service.js). Trước đó lễ tân chọn 'cap_cuu' vẫn không
// lọc lại được vì audit không lưu mức ưu tiên — đây là điều kiện cần để báo cáo này tồn tại.
// KHÔNG tạo bảng mới: đủ dữ liệu để tổng hợp bằng một truy vấn audit + join HangDoi hiện tại.

/**
 * Danh sách ca cấp cứu tiếp nhận trong một ngày.
 * @param {object}  p
 * @param {string?} p.ngay - ISO date; thiếu thì lấy hôm nay
 */
export async function layBaoCaoCaKhan({ ngay = null } = {}) {
  const tu = ngay ? startOfDayUtc(new Date(ngay)) : startOfDayUtc(new Date())
  const den = new Date(tu)
  den.setUTCDate(den.getUTCDate() + 1)

  const records = await NhatKyThaoTac.find({
    hanh_dong: 'LT_OFFLINE_INTAKE_CENTRAL',
    'du_lieu_moi.muc_uu_tien_tiep_nhan': 'cap_cuu',
    ngay_tao: { $gte: tu, $lt: den },
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1 })
    .lean()

  if (records.length === 0) return []

  const queueIds = records.map((r) => r.doi_tuong_id)
  const entries = await HangDoi.find({ _id: { $in: queueIds } })
    .select('trang_thai doctor_id phong_kham ma_so_thu_tu thoi_diem_ket_thuc')
    .lean()
  const entryById = new Map(entries.map((e) => [String(e._id), e]))

  const doctorIds = entries.filter((e) => e.doctor_id).map((e) => e.doctor_id)
  const doctors = doctorIds.length
    ? await BacSi.find({ _id: { $in: doctorIds } }).populate('user_id', 'ho_ten').select('user_id').lean()
    : []
  const doctorById = new Map(doctors.map((d) => [String(d._id), d]))

  return records.map((r) => {
    const entry = entryById.get(String(r.doi_tuong_id))
    const doctor = entry?.doctor_id ? doctorById.get(String(entry.doctor_id)) : null
    return {
      id: String(r._id),
      queue_id: String(r.doi_tuong_id),
      thoi_diem_tiep_nhan: r.ngay_tao,
      nguoi_tiep_nhan: r.nguoi_thuc_hien_id?.ho_ten ?? 'Hệ thống',
      ten_benh_nhan: r.du_lieu_moi?.ten_benh_nhan ?? null,
      so_dien_thoai: r.du_lieu_moi?.so_dien_thoai ?? null,
      ma_so_thu_tu: r.du_lieu_moi?.ma_so_thu_tu ?? entry?.ma_so_thu_tu ?? null,
      ly_do_cap_cuu: r.du_lieu_moi?.ly_do_uu_tien ?? null,
      trang_thai_hien_tai: entry?.trang_thai ?? null,
      bac_si_phu_trach: doctor?.user_id?.ho_ten ?? null,
      phong_kham: entry?.phong_kham ?? null,
      thoi_diem_hoan_thanh: entry?.thoi_diem_ket_thuc ?? null,
    }
  })
}
