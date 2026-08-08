import { NhatKyThaoTac } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'
import {
  MA_HANH_DONG_LE_TAN,
  NHOM_HANH_DONG,
  nhanHanhDong,
  nhomCuaHanhDong,
} from './receptionistAudit.service.js'

// ============================================================
// WS-4 — Truy vấn "Nhật ký ca trực"
// ============================================================
// Mục đích vận hành: khi một trong hai lễ tân nghỉ, người còn lại mở trang này để biết
// việc đang dở tới đâu và ai đã xử lý khách nào. Vì vậy bộ lọc phải theo NGÀY và theo
// NGƯỜI, không phải theo từng bản ghi.

/**
 * Mã hành động cần lọc theo nhóm UI chọn.
 *
 * Nhóm rỗng hoặc không hợp lệ → trả TOÀN BỘ, không trả mảng rỗng. Trả rỗng sẽ làm trang
 * trắng trơn và người dùng hiểu nhầm là "hôm nay không ai làm gì".
 */
export function locMaTheoNhom(nhom = null) {
  if (nhom && NHOM_HANH_DONG[nhom]) return [...NHOM_HANH_DONG[nhom]]
  return [...MA_HANH_DONG_LE_TAN]
}

/** Chuyển 1 document audit sang shape UI dùng. Hàm thuần — không chạm DB. */
export function dinhDangBanGhi(record) {
  const duLieu = record.du_lieu_moi ?? null
  return {
    id:             String(record._id),
    thoi_diem:      record.ngay_tao,
    hanh_dong:      record.hanh_dong,
    nhan_hanh_dong: nhanHanhDong(record.hanh_dong),
    nhom:           nhomCuaHanhDong(record.hanh_dong),
    nguoi_thuc_hien_id: record.nguoi_thuc_hien_id?._id
      ? String(record.nguoi_thuc_hien_id._id)
      : null,
    // Cron và migration ghi audit với `nguoi_thuc_hien_id = null` (vai_tro='system').
    nguoi_thuc_hien: record.nguoi_thuc_hien_id?.ho_ten ?? 'Hệ thống',
    loai_doi_tuong: record.loai_doi_tuong,
    doi_tuong_id:   String(record.doi_tuong_id),
    ten_khach:      duLieu?.ten_benh_nhan ?? null,
    chi_tiet:       duLieu,
  }
}

/**
 * Nhật ký của một ngày.
 *
 * @param {object}  p
 * @param {string?} p.ngay     - ISO date; thiếu thì lấy hôm nay
 * @param {string?} p.nguoiId  - lọc theo người thực hiện
 * @param {string?} p.nhom     - 'tiep_nhan' | 'thanh_toan' | 'lich_hen' | 'lien_he'
 */
export async function layNhatKyCaTruc({ ngay = null, nguoiId = null, nhom = null } = {}) {
  const tu = ngay ? startOfDayUtc(new Date(ngay)) : startOfDayUtc(new Date())
  const den = new Date(tu)
  den.setUTCDate(den.getUTCDate() + 1)

  const filter = {
    hanh_dong: { $in: locMaTheoNhom(nhom) },
    ngay_tao: { $gte: tu, $lt: den },
  }
  if (nguoiId) filter.nguoi_thuc_hien_id = nguoiId

  const records = await NhatKyThaoTac.find(filter)
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1, _id: -1 })
    .limit(500)
    .lean()

  return records.map(dinhDangBanGhi)
}
