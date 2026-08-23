// ============================================================
// LUẬT ĐIỀU PHỐI DỜI LỊCH — hàm THUẦN, KHÔNG import model, KHÔNG chạm DB
// ============================================================
// Tách ra khỏi appointmentReschedule.service.js để kiểm thử được bằng `node --test`
// mà không cần MongoDB — cùng cách walkInWindow.service.js đang làm.
//
// Vì sao cần: `status = 'locked'` trong `slots[]` đang mang BA nghĩa khác nhau —
//   (a) chỗ đang GIỮ SẴN cho một đề xuất dời  → benh_nhan_tam_giu_id != null
//   (b) slot CŨ của một lịch đã dời đi         → mọi field bệnh nhân đều null
//   (c) slot bị khoá vì BÁC SĨ NGHỈ            → bi_khoa_boi_nghi_phep = true
// Gộp ba nghĩa vào một trạng thái là gốc của lỗi P0-3: query chiếm slot nhận MỌI
// `locked`, nên một lịch hẹn có thể bị đẩy vào slot của bác sĩ ĐANG NGHỈ.

/** Đề xuất còn "mở" — chưa áp dụng, chưa huỷ. */
export const TRANG_THAI_DE_XUAT_MO = ['cho_khach_chon', 'cho_admin_duyet']

/** (a) — chỗ đang giữ sẵn cho một đề xuất dời, KHÔNG phải slot bị khoá vì nghỉ phép. */
export function laSlotGiuChoDeXuat(slot) {
  return slot?.status === 'locked'
    && !slot.bi_khoa_boi_nghi_phep
    && slot.benh_nhan_tam_giu_id != null
}

/**
 * Slot có phải khoá lại khi bác sĩ báo nghỉ không.
 *
 * `booked` KHÔNG đụng — đã có `LichHen` thật, xử lý qua luồng điều phối (sinh đề xuất dời).
 * Nhánh `laSlotGiuChoDeXuat` là phần VÁ P0-3: trước đây bộ lọc chỉ có
 * `['active','pending_payment']`, nên slot đang giữ sẵn cho khách khác (đã ở `locked`)
 * bị bỏ qua hoàn toàn — `bi_khoa_boi_nghi_phep` giữ nguyên `false`, và cron quá hạn sau đó
 * đẩy khách vào đúng slot của bác sĩ vừa nghỉ.
 */
export function nenKhoaSlotVaoDonNghi(slot) {
  return ['active', 'pending_payment'].includes(slot?.status) || laSlotGiuChoDeXuat(slot)
}

/**
 * Mảnh điều kiện `$elemMatch` để CHIẾM slot đích khi áp dụng một phương án.
 *
 * ⛔ `bi_khoa_boi_nghi_phep` bị loại VÔ ĐIỀU KIỆN ở cả hai nhánh — không bao giờ đẩy khách
 * vào slot của một bác sĩ đang nghỉ.
 *
 * Cố ý KHÔNG so `benh_nhan_tam_giu_id === appointment.user_id`: khách vãng lai không có
 * `user_id`, `giuChoPhuongAn()` ghi `null` vào đó, nên phép so sánh sẽ khớp nhầm với MỌI
 * slot `locked` rỗng khác. Cờ `da_giu_cho` nằm trong chính `de_xuat_doi` của lịch hẹn này,
 * là nguồn tin cậy hơn.
 */
export function dieuKienChiemSlot(phuongAn) {
  const dieuKien = {
    _id: phuongAn.slot_id,
    bi_khoa_boi_nghi_phep: { $ne: true },
  }
  if (phuongAn.da_giu_cho) {
    dieuKien.status = 'locked'
  } else {
    dieuKien.status = 'active'
    dieuKien.benh_nhan_id = null
  }
  return dieuKien
}

/**
 * Mảnh `$set` cho slot CŨ sau khi lịch hẹn đã chuyển đi.
 *
 * `khoaSlotCu = true` (lỗi phòng khám, mục 15): bác sĩ bận thật, không bán lại cho ai.
 * `khoaSlotCu = false` (khách tự xin dời, mục 11): trả về pool để bán lại — nếu không,
 * mỗi lần khách dời là phòng khám mất hẳn một chỗ bán được.
 */
export function capNhatSlotCuSauKhiDoi(khoaSlotCu) {
  const chung = {
    'slots.$.benh_nhan_id': null,
    'slots.$.benh_nhan_tam_giu_id': null,
  }
  return khoaSlotCu
    ? { ...chung, 'slots.$.status': 'locked' }
    : { ...chung, 'slots.$.status': 'active', 'slots.$.pending_expired_at': null }
}

/**
 * Một đơn nghỉ mới có được phép sinh (lại) đề xuất cho lịch hẹn này không.
 *
 * Trước đây bộ lọc là `!appointment.de_xuat_doi` — chặn cả đề xuất CÒN MỞ, nên lịch hẹn
 * dính hai đơn nghỉ liên tiếp bị treo với phương án cũ đã hỏng (P1-6).
 */
export function nenSinhLaiDeXuat(deXuatDoi) {
  if (!deXuatDoi) return true
  return TRANG_THAI_DE_XUAT_MO.includes(deXuatDoi.trang_thai)
}
