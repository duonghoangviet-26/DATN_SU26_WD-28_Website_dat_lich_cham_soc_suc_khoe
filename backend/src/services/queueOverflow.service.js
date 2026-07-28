import { ChuyenKhoa, HangDoi } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'
import { MAC_DINH_THOI_GIAN_KHAM_PHUT } from '../utils/slotConfig.js'

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
function ganSession(query, session) {
  return session ? query.session(session) : query
}

async function tinhChiTietDoTreCa(doctorId, now = new Date(), session = null) {
  if (!doctorId) {
    return {
      doTrePhut: 0,
      nguyenNhanDoTre: 'khong_tre',
      soNguoiDangCho: 0,
      soNguoiDangXuLy: 0,
      thoiDiemKhungSomNhat: null,
      thoiGianKhamVuotChuanPhut: 0,
    }
  }

  const dayStart = startOfDayUtc(now)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const entriesQuery = HangDoi.find({
    doctor_id: doctorId,
    checkin_time: { $gte: dayStart, $lt: dayEnd },
    trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
  }).select('trang_thai gio_hen_goc thoi_diem_vao_phong specialty_id')
  const entries = await ganSession(entriesQuery, session).lean()

  const waitingEntries = entries
    .filter((entry) => entry.trang_thai === 'dang_cho' && entry.gio_hen_goc)
    .sort((a, b) => new Date(a.gio_hen_goc) - new Date(b.gio_hen_goc))
  const earliestWaiting = waitingEntries[0] ?? null
  const queueDelay = earliestWaiting
    ? Math.max(0, Math.round((now.getTime() - new Date(earliestWaiting.gio_hen_goc).getTime()) / 60_000))
    : 0

  const inRoomEntries = entries.filter((entry) => entry.trang_thai === 'trong_phong' && entry.thoi_diem_vao_phong)
  const specialtyIds = [...new Set(inRoomEntries.map((entry) => entry.specialty_id ? String(entry.specialty_id) : null).filter(Boolean))]
  const specialtiesQuery = ChuyenKhoa.find({ _id: { $in: specialtyIds } })
    .select('_id thoi_gian_kham_trung_binh_phut')
  const specialties = specialtyIds.length ? await ganSession(specialtiesQuery, session).lean() : []
  const averageBySpecialty = new Map(specialties.map((specialty) => [
    String(specialty._id), Number(specialty.thoi_gian_kham_trung_binh_phut) || MAC_DINH_THOI_GIAN_KHAM_PHUT,
  ]))

  const inRoomOverrun = inRoomEntries.reduce((max, entry) => {
    const average = averageBySpecialty.get(String(entry.specialty_id)) || MAC_DINH_THOI_GIAN_KHAM_PHUT
    const elapsed = Math.max(0, Math.round((now.getTime() - new Date(entry.thoi_diem_vao_phong).getTime()) / 60_000))
    return Math.max(max, Math.max(0, elapsed - average))
  }, 0)

  const doTrePhut = Math.max(queueDelay, inRoomOverrun)
  const nguyenNhanDoTre = doTrePhut === 0
    ? 'khong_tre'
    : queueDelay >= inRoomOverrun
      ? 'hang_doi'
      : 'trong_phong'

  return {
    doTrePhut,
    nguyenNhanDoTre,
    soNguoiDangCho: entries.filter((entry) => entry.trang_thai === 'dang_cho').length,
    soNguoiDangXuLy: entries.length,
    thoiDiemKhungSomNhat: earliestWaiting?.gio_hen_goc ?? null,
    thoiGianKhamVuotChuanPhut: inRoomOverrun,
  }
}

export async function tinhDoTreCa(doctorId, now = new Date(), session = null) {
  const detail = await tinhChiTietDoTreCa(doctorId, now, session)
  return detail.doTrePhut ?? 0
}

/**
 * Tình trạng quá tải của một bác sĩ trong ngày.
 * @returns {Promise<{doTrePhut: number, ngungBanWalkIn: boolean, chanDatOnline: boolean, canhBao: string|null}>}
 */
export async function kiemTraQuaTai(doctorId, now = new Date(), session = null) {
  const detail = await tinhChiTietDoTreCa(doctorId, now, session)
  const doTrePhut = detail.doTrePhut
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

  return {
    doTrePhut,
    nguyenNhanDoTre: detail.nguyenNhanDoTre,
    soNguoiDangCho: detail.soNguoiDangCho,
    soNguoiDangXuLy: detail.soNguoiDangXuLy,
    thoiDiemKhungSomNhat: detail.thoiDiemKhungSomNhat,
    thoiGianKhamVuotChuanPhut: detail.thoiGianKhamVuotChuanPhut,
    ngungBanWalkIn,
    chanDatOnline,
    canhBao,
  }
}
