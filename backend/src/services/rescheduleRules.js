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

// ============================================================
// CHẤM ĐIỂM PHƯƠNG ÁN — quyết định thứ tự đề xuất (mục 15, A3/A4)
// ============================================================

/**
 * Số ngày tìm phương án, kể từ ngày khám gốc. Trước 2026-08-23 chỉ tìm ĐÚNG 1 ngày, nên
 * bác sĩ nghỉ cả ngày mà không có đồng nghiệp cùng chuyên khoa trực hôm đó thì 100% lịch
 * rơi vào diện "phải liên hệ tay".
 */
export const SO_NGAY_TIM_PHUONG_AN = Number(process.env.DOI_LICH_SO_NGAY_TIM || 7)

/**
 * Phạt cộng thêm cho mỗi ngày phải nhảy sang. 480' = 8 tiếng, dài hơn cả khoảng cách
 * lớn nhất trong một ngày (08:00 → 17:00 = 540'... trừ hai đầu ca), nên mọi slot CÙNG NGÀY
 * gần như luôn xếp trước slot ngày hôm sau — đúng ý "ưu tiên triệt để trong ngày".
 */
export const PHAT_MOI_NGAY_PHUT = Number(process.env.DOI_LICH_PHAT_NGAY_PHUT || 480)

/** Hiệu số phút giữa hai mốc `HH:MM`, có dấu. */
export function khoangCachKhung(hhmmA, hhmmB) {
  const phut = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number)
    return h * 60 + m
  }
  return phut(hhmmA) - phut(hhmmB)
}

/** Điểm lệch của một ứng viên so với khung gốc — càng nhỏ càng được ưu tiên. */
export function diemLechPhuongAn({ gioSlot, gioGoc, soNgayLech = 0 }) {
  return Math.abs(khoangCachKhung(gioSlot, gioGoc)) + soNgayLech * PHAT_MOI_NGAY_PHUT
}
