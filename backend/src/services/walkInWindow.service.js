import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'
import { caCuaKhung } from '../models/MauLichLamViec.js'

// ============================================================
// CỬA SỔ TIẾP NHẬN TẠI QUẦY — rule mục 13
// ============================================================
// ⛔ Lễ tân KHÔNG nhận đặt lịch qua điện thoại và KHÔNG đặt hộ cho ngày tương lai.
// Khách gọi tới chỉ được báo MỨC ĐỘ còn trống, không có con số — con số thành lời hứa,
// khách tới nơi hết chỗ sẽ khiếu nại.
//
// Chính sách chỉ đứng vững nếu code chặn được. Ba ràng buộc:
//   1. Chỉ NGÀY HÔM NAY.
//   2. Chỉ slot `loai_slot='walk_in'` — không bao giờ chạm slot online.
//      (Slot online chưa bán tự chảy sang walk-in tại `T-30'`, xem mục 4/11.)
//   3. Chỉ khung ĐANG DIỄN RA hoặc khung KẾ TIẾP, trong cùng một ca.
//
// Ràng buộc 3 chống chuyện lễ tân "giữ chỗ giùm" cho khách quen vào khung xa cuối ca:
// khách tới quầy là để khám ngay, không phải để đặt trước.

/** Khung 30' — khớp DEFAULT_SLOT_TIMES trong scheduleGenerator. */
const DO_DAI_KHUNG_PHUT = 30

/**
 * Các khung lễ tân được phép bán tại thời điểm `now`.
 *
 * Khung hợp lệ khi CHƯA kết thúc (`now < T + 30'`) và bắt đầu trong vòng 30 phút tới
 * (`T ≤ now + 30'`) — tức đúng hai khung: đang diễn ra + kế tiếp. Thêm điều kiện cùng ca
 * với khung đang diễn ra, để 11:00 không bán được sang 13:30.
 *
 * @returns {Set<number>} tập `khung_index` được phép
 */
export function cacKhungDuocBanTaiQuay(slots, ngay, now = new Date()) {
  const duocBan = new Set()
  if (!slots?.length) return duocBan

  let caHienTai = null
  let khungGanNhat = null

  for (const slot of slots) {
    const T = buildSlotDateTime(ngay, slot.gio_bat_dau)
    if (!T) continue
    const ketThuc = T.getTime() + DO_DAI_KHUNG_PHUT * 60_000

    if (now.getTime() >= T.getTime() && now.getTime() < ketThuc) {
      caHienTai = caCuaKhung(slot.khung_index)
      break
    }
    if (T.getTime() > now.getTime() && (khungGanNhat === null || T.getTime() < khungGanNhat.thoiDiem)) {
      khungGanNhat = { thoiDiem: T.getTime(), khung_index: slot.khung_index }
    }
  }

  // NGOÀI giờ khám (chưa mở cửa / đang nghỉ trưa): không có khung nào "đang diễn ra".
  // Khách vẫn đang đứng ở quầy, nên vẫn nhận — vào ĐÚNG khung sắp tới gần nhất, không
  // mở rộng thêm. Đây không phải đặt hộ: người ta có mặt tại chỗ.
  if (caHienTai === null) {
    if (khungGanNhat) duocBan.add(khungGanNhat.khung_index)
    return duocBan
  }

  // TRONG giờ khám: khung đang diễn ra + khung kế tiếp, giới hạn trong cùng một ca
  // (11:00 không được bán sang 13:30).
  for (const slot of slots) {
    if (caCuaKhung(slot.khung_index) !== caHienTai) continue
    const T = buildSlotDateTime(ngay, slot.gio_bat_dau)
    if (!T) continue
    const chuaKetThuc = now.getTime() < T.getTime() + DO_DAI_KHUNG_PHUT * 60_000
    const batDauTrongTamVoi = T.getTime() <= now.getTime() + DO_DAI_KHUNG_PHUT * 60_000
    if (chuaKetThuc && batDauTrongTamVoi) duocBan.add(slot.khung_index)
  }

  return duocBan
}

/** Slot lễ tân được bán: walk-in, đang trống, không bị khoá, thuộc khung được phép. */
export function locSlotBanTaiQuay(schedule, now = new Date()) {
  const duocBan = cacKhungDuocBanTaiQuay(schedule.slots, schedule.ngay, now)
  return schedule.slots.filter(
    (s) => s.status === 'active'
      && s.loai_slot === 'walk_in'
      && !s.benh_nhan_id
      && !s.benh_nhan_tam_giu_id
      && !s.bi_khoa_boi_nghi_phep
      && duocBan.has(s.khung_index),
  )
}

/** Ngày yêu cầu có phải hôm nay không. */
export function laHomNay(ngay, now = new Date()) {
  const a = startOfDayUtc(ngay)
  const b = startOfDayUtc(now)
  return Boolean(a && b && a.getTime() === b.getTime())
}

// ── Tra cứu mức độ còn trống (rule mục 13) ──────────────────────────────────
// Trả MỨC ĐỘ, không trả con số. Khách gọi điện nghe "còn 3 chỗ" sẽ hiểu là đã giữ 3 chỗ
// cho mình; tới nơi hết chỗ thì thành khiếu nại. "Còn nhiều / còn ít / đã đầy" nói đủ
// để khách quyết định có đi hay không, mà không hứa gì.
export const MUC_DO = {
  CON_NHIEU: 'con_nhieu',
  CON_IT: 'con_it',
  DA_DAY: 'da_day',
}

const NHAN_MUC_DO = {
  [MUC_DO.CON_NHIEU]: 'Còn nhiều chỗ',
  [MUC_DO.CON_IT]: 'Còn ít chỗ',
  [MUC_DO.DA_DAY]: 'Đã đầy',
}

/** Ngưỡng "còn ít": từ 1 tới 3 chỗ. Trên đó là "còn nhiều". */
const NGUONG_CON_IT = 3

export function xepMucDo(soChoTrong) {
  if (soChoTrong <= 0) return MUC_DO.DA_DAY
  if (soChoTrong <= NGUONG_CON_IT) return MUC_DO.CON_IT
  return MUC_DO.CON_NHIEU
}

export function nhanMucDo(mucDo) {
  return NHAN_MUC_DO[mucDo] ?? mucDo
}
