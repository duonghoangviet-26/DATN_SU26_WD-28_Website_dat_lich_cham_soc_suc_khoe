// ============================================================
// GIỜ PHÒNG KHÁM — nguồn chuẩn DUY NHẤT để đổi "HH:MM" thành mốc thời gian tuyệt đối.
// ============================================================
// BỐI CẢNH:
//   `config/timezone.js` ép process.env.TZ = 'UTC' cho toàn tiến trình, nên setHours() và
//   setUTCHours() là MỘT. Vì vậy dùng setHours() KHÔNG tự động ra "giờ Việt Nam".
//
//   Chuỗi `slots.gio_bat_dau` / `LichHen.gio_kham` là GIỜ PHÒNG KHÁM (Asia/Ho_Chi_Minh, UTC+7).
//   Muốn so sánh với `new Date()` (mốc tuyệt đối) thì phải TRỪ 7 giờ.
//
// LỖI TỪNG XẢY RA (2026-07-25): `patient/booking.controller.js` dùng setUTCHours(hours) —
//   hiểu "08:00" thành 08:00Z = 15:00 giờ VN. Lúc 14:02 VN, hệ thống vẫn chào bán và THU TIỀN
//   khung 08:00 đã trôi qua 6 tiếng. Bản `receptionist/booking.controller.js` thì đúng
//   (hours - 7) — hai file cùng tên hàm, hai cách hiện thực. File này tồn tại để chấm dứt
//   tình trạng đó: MỌI nơi so giờ khám phải import từ đây.
//
// ⚠️ KHÔNG tự viết lại phép đổi giờ ở nơi khác. Cần thêm phép tính mới thì thêm vào file này.

/** Lệch múi giờ phòng khám so với UTC, tính bằng giờ. Asia/Ho_Chi_Minh = UTC+7, không có DST. */
export const CLINIC_UTC_OFFSET_HOURS = 7

/**
 * Đổi (ngày, "HH:MM" giờ phòng khám) thành Date tuyệt đối.
 * @param {Date|string} dateOnly - ngày (phần giờ bị bỏ qua)
 * @param {string} hhmm - "HH:MM" theo giờ phòng khám
 * @returns {Date|null} null nếu hhmm không hợp lệ
 */
export function buildSlotDateTime(dateOnly, hhmm) {
  const [hours, minutes] = String(hhmm || '').split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  const dateTime = new Date(dateOnly)
  if (Number.isNaN(dateTime.getTime())) return null
  dateTime.setUTCHours(hours - CLINIC_UTC_OFFSET_HOURS, minutes, 0, 0)
  return dateTime
}

/**
 * Khung giờ đã trôi qua chưa. hhmm không hợp lệ -> coi như đã qua (an toàn: không chào bán).
 */
export function isSlotInPast(dateOnly, hhmm, now = new Date()) {
  const slotDateTime = buildSlotDateTime(dateOnly, hhmm)
  return !slotDateTime || slotDateTime.getTime() <= now.getTime()
}

/** Đầu ngày (00:00 UTC) của một ngày — dùng chung cho filter theo ngày. */
export function startOfDayUtc(value = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  return date
}
