import { HangDoi } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

// ============================================================
// OVERFLOW CONTROL — ngừng bán khi ca đã trễ (rule mục 6)
// ============================================================
// Bán hết công suất rồi vẫn tiếp tục bán khi ca đang trễ là cách chắc chắn nhất để biến
// một buổi chiều muộn 30 phút thành một buổi tối muộn 2 tiếng. Hai nấc, tăng dần theo
// độ trễ tích luỹ của ca:
//
//   trễ ≥ 1 khung (30')  → ngừng bán slot WALK-IN cho các khung còn lại + cảnh báo lễ tân
//   trễ ≥ 2 khung (60')  → chặn cả ĐẶT ONLINE vào các khung còn lại của ca đó
//
// Ngưỡng là CẤU HÌNH, không hardcode (rule mục 6) — đổi qua biến môi trường.

export const NGUONG_NGUNG_BAN_WALKIN_PHUT = Number(process.env.OVERFLOW_NGUNG_WALKIN_PHUT || 30)
export const NGUONG_CHAN_DAT_ONLINE_PHUT = Number(process.env.OVERFLOW_CHAN_ONLINE_PHUT || 60)

/**
 * Độ trễ tích luỹ của ca, tính bằng phút.
 *
 * Đo bằng người ĐANG CHỜ có khung sớm nhất: nếu bệnh nhân khung 09:00 mà 09:35 vẫn chưa
 * được gọi thì ca đang trễ 35 phút. Đây là con số bệnh nhân thực sự cảm nhận, khác với
 * "dự kiến xong lúc mấy giờ" (ước lượng tương lai, đã có ở `tinhCanhBaoQuaTai`).
 *
 * Người đến sớm cho ra số âm -> kẹp về 0: chưa tới khung của họ thì chưa ai trễ cả.
 */
export async function tinhDoTreCa(doctorId, now = new Date()) {
  if (!doctorId) return 0

  const dangCho = await HangDoi.find({
    doctor_id: doctorId,
    trang_thai: 'dang_cho',
    gio_hen_goc: { $ne: null },
    checkin_time: { $gte: startOfDayUtc(now) },
  })
    .select('gio_hen_goc')
    .sort({ gio_hen_goc: 1 })
    .limit(1)
    .lean()

  if (dangCho.length === 0) return 0
  const treMs = now.getTime() - new Date(dangCho[0].gio_hen_goc).getTime()
  return Math.max(0, Math.round(treMs / 60_000))
}

/**
 * Tình trạng quá tải của một bác sĩ trong ngày.
 * @returns {Promise<{doTrePhut: number, ngungBanWalkIn: boolean, chanDatOnline: boolean, canhBao: string|null}>}
 */
export async function kiemTraQuaTai(doctorId, now = new Date()) {
  const doTrePhut = await tinhDoTreCa(doctorId, now)
  const chanDatOnline = doTrePhut >= NGUONG_CHAN_DAT_ONLINE_PHUT
  const ngungBanWalkIn = doTrePhut >= NGUONG_NGUNG_BAN_WALKIN_PHUT

  let canhBao = null
  if (chanDatOnline) {
    canhBao = `Ca đang trễ ${doTrePhut} phút. Đã ngừng nhận thêm lượt cho các khung còn lại — `
      + 'khách mới xin mời chọn bác sĩ khác hoặc ngày khác.'
  } else if (ngungBanWalkIn) {
    canhBao = `Ca đang trễ ${doTrePhut} phút. Đã ngừng nhận khách tới quầy cho các khung còn lại; `
      + 'lượt đã đặt online vẫn nhận bình thường.'
  }

  return { doTrePhut, ngungBanWalkIn, chanDatOnline, canhBao }
}
