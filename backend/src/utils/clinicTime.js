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

/**
 * Đầu ngày theo lịch phòng khám (Asia/Ho_Chi_Minh), trả về mốc UTC.
 * Dùng cho dữ liệu có thời điểm tuyệt đối như `HangDoi.checkin_time`.
 */
export function startOfClinicDayUtc(value = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const clinicDate = new Date(date.getTime() + CLINIC_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  return new Date(Date.UTC(
    clinicDate.getUTCFullYear(),
    clinicDate.getUTCMonth(),
    clinicDate.getUTCDate(),
  ))
}

// ============================================================
// MỐC THỜI GIAN CỦA MỘT KHUNG — rule mục 11 (BẤT BIẾN)
// ============================================================
// Khung bắt đầu lúc `T`:
//   T-30'  đóng đặt online; slot online chưa bán chuyển thành walk-in.
//          Cũng là hạn chót xin dời lịch.
//   T-15'  hạn chót MỌI giữ chỗ chờ thanh toán của khung này.
//   T → T+15'   grace: khách online giữ ưu tiên `online_uu_tien`.
//   T+15' → hết ca  trễ: vẫn khám, tụt xuống mức `offline`, KHÔNG mất tiền.
//
// Các số này là CHÍNH SÁCH, không phải hằng số kỹ thuật — gom về một chỗ để đổi một lần.
export const PHUT_DONG_DAT_ONLINE = 30 // T-30'
export const PHUT_HAN_CHOT_GIU_CHO = 15 // T-15'
export const PHUT_GRACE = 15 // T+15'

function congPhut(moc, phut) {
  return moc ? new Date(moc.getTime() + phut * 60_000) : null
}

/**
 * Mọi mốc của một khung. Trả null nếu không dựng được `T`.
 * @returns {{T: Date, dongDatOnline: Date, hanChotGiuCho: Date, hetGrace: Date}|null}
 */
export function cacMocCuaKhung(dateOnly, hhmm) {
  const T = buildSlotDateTime(dateOnly, hhmm)
  if (!T) return null
  return {
    T,
    dongDatOnline: congPhut(T, -PHUT_DONG_DAT_ONLINE),
    hanChotGiuCho: congPhut(T, -PHUT_HAN_CHOT_GIU_CHO),
    hetGrace: congPhut(T, PHUT_GRACE),
  }
}

/**
 * Đã qua mốc đóng đặt online (`T-30'`) chưa. Không dựng được mốc -> coi như đã qua
 * (an toàn: không chào bán khung không rõ giờ).
 */
export function daQuaCutoffOnline(dateOnly, hhmm, now = new Date()) {
  const moc = cacMocCuaKhung(dateOnly, hhmm)
  return !moc || now.getTime() >= moc.dongDatOnline.getTime()
}

/**
 * Hạn giữ chỗ chờ thanh toán, CO GIÃN theo rule mục 11: `min(15', T-15' − now)`.
 *
 * Cửa sổ cố định 15' sẽ để giữ chỗ chết QUA mốc `T-15'` rồi mới nhả — đúng lúc lễ tân đã
 * hết quyền bán khung đó, ghế trống mà không ai ngồi được. Co giãn bảo đảm slot bỏ dở
 * luôn được trả về pool TRƯỚC cutoff.
 *
 * @returns {Date|null} null khi đã quá `T-15'` — không được phép giữ chỗ nữa.
 */
export function hanGiuChoCoGian(dateOnly, hhmm, now = new Date(), phutToiDa = PHUT_HAN_CHOT_GIU_CHO) {
  const moc = cacMocCuaKhung(dateOnly, hhmm)
  if (!moc) return null
  const hanToiDa = congPhut(now, phutToiDa)
  if (moc.hanChotGiuCho.getTime() <= now.getTime()) return null
  return hanToiDa.getTime() < moc.hanChotGiuCho.getTime() ? hanToiDa : moc.hanChotGiuCho
}
