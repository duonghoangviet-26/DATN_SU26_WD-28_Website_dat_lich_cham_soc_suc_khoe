import { BacSi, HangDoi, LichHen, LichLamViec, NguoiDung, NhatKyThaoTac, ThongBao } from '../models/index.js'
import { caTheoGio, CA_SANG } from '../models/MauLichLamViec.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'

// ============================================================
// ĐÁNH DẤU `no_show` KHI HẾT CA — rule mục 8
// ============================================================
// Rule mục 8 chốt ba điều, và trước file này KHÔNG có gì thực hiện điều nào:
//
//   1. `no_show` CHỈ được đặt TỰ ĐỘNG, khi kết thúc ca VÀ không tồn tại bản ghi `HangDoi`.
//   2. Lễ tân/bác sĩ KHÔNG được set tay — vì `no_show` đồng nghĩa mất 100% tiền (mục 5).
//   3. Đã bước chân tới quầy (có `HangDoi`) thì KHÔNG BAO GIỜ thành `no_show`, trễ bao lâu
//      cũng vậy.
//
// Hệ quả khi thiếu: lịch hẹn của khách không đến treo `confirmed` vĩnh viễn, lẫn vào danh
// sách chờ khám của bác sĩ ngày này qua ngày khác, và thống kê "tỉ lệ không đến" luôn bằng 0.
//
// ⚠️ Hàm này XOÁ TIỀN của khách (mục 5: no_show = mất 100%), nên mọi điều kiện loại trừ ở
// dưới đều là điều kiện AN TOÀN — thà bỏ sót một lịch còn hơn phạt oan một người đã tới.

// Công tắc vận hành. Bật theo mặc định vì rule mục 8 yêu cầu `no_show` phải được đặt TỰ ĐỘNG.
// Đặt `NO_SHOW_SWEEP_ENABLED=false` để tắt trong buổi demo hoặc khi đang dựng dữ liệu mẫu:
// lịch hẹn trong demo thường không ai check-in, mà mỗi lần đánh dấu là 100% tiền của một
// bản ghi (mục 5) — không nên để cron âm thầm đổi dữ liệu người khác đang trình bày.
// Chỉ ảnh hưởng LƯỢT QUÉT ĐỊNH KỲ; gọi tay `quetNoShowHetCa()` vẫn chạy bình thường.
//
// Nhận cả `false`/`FALSE`/`0`/`off`/`no`: đây là công tắc chặn một hành động mất tiền, ai gõ
// `FALSE` mà hệ thống vẫn quét thì lỗi thuộc về cái công tắc, không thuộc về người gõ.
const TAT = new Set(['false', '0', 'off', 'no'])
export const BAT_QUET_NO_SHOW = !TAT.has(String(process.env.NO_SHOW_SWEEP_ENABLED ?? 'true').trim().toLowerCase())

// Giờ kết thúc ca mặc định, dùng khi không tra được lịch làm việc thật.
// Khớp `DEFAULT_SLOT_TIMES` của `scheduleGenerator`: ca sáng 08:00–11:30, chiều 13:30–17:30.
const GIO_KET_THUC_CA_MAC_DINH = { sang: '11:30', chieu: '17:30' }

// Chỉ hai trạng thái này mới có thể thành `no_show`.
//
// KHÔNG gồm `checked_in`: dữ liệu cũ có thể mang `checked_in` mà không có `HangDoi` (do lỗi
// luồng lễ tân trước 2026-07-26 — xem `services/checkIn.service.js`). Những người đó ĐÃ tới
// quầy; phạt họ mất tiền vì một lỗi của hệ thống là điều tuyệt đối không được làm.
const TRANG_THAI_CO_THE_NO_SHOW = ['pending', 'confirmed']

/**
 * Giờ kết thúc CA của một lịch hẹn, lấy từ lịch làm việc thật khi có.
 *
 * Dùng slot muộn nhất trong CÙNG CA thay vì hằng số: ca có thể kết thúc sớm hơn mặc định
 * (bác sĩ chỉ đăng ký nửa ca) và khi đó chờ tới 17:30 mới đánh dấu là chờ vô ích.
 */
function gioKetThucCa(schedule, gioKham) {
  const ca = caTheoGio(gioKham)
  const slotsCungCa = (schedule?.slots ?? []).filter((s) => caTheoGio(s.gio_bat_dau) === ca)
  if (slotsCungCa.length === 0) return GIO_KET_THUC_CA_MAC_DINH[ca] ?? GIO_KET_THUC_CA_MAC_DINH[CA_SANG]
  return slotsCungCa.reduce((max, s) => (s.gio_ket_thuc > max ? s.gio_ket_thuc : max), '00:00')
}

/**
 * Ca của lịch hẹn có bị ảnh hưởng bởi việc bác sĩ nghỉ không.
 *
 * Rule mục 8: "Lịch hẹn thuộc ca có bác sĩ nghỉ KHÔNG BAO GIỜ được tự động chuyển no_show."
 * Khách không đến vì phòng khám đã hủy ca — lỗi không thuộc về họ.
 */
function caBiNghi(schedule, appt) {
  if (!schedule) return true // không tra được lịch làm việc -> không dám kết luận
  if (schedule.trang_thai_ngay !== 'lam_viec') return true
  if (schedule.trang_thai_xac_nhan === 'tu_choi') return true

  const slot = appt.slot_id
    ? schedule.slots?.find((s) => String(s._id) === String(appt.slot_id))
    : schedule.slots?.find((s) => s.gio_bat_dau === appt.gio_kham)
  return Boolean(slot?.bi_khoa_boi_nghi_phep)
}

/**
 * Quét và đánh dấu `no_show` cho các lịch hẹn đã hết ca mà không ai tới quầy.
 *
 * @param {object}  opts
 * @param {Date}    opts.now
 * @param {boolean} opts.apply   - false = chỉ liệt kê, không ghi (mặc định true)
 * @param {number}  opts.soNgay  - số ngày lùi lại để quét. MẶC ĐỊNH 1 = chỉ hôm nay.
 *   Cố ý không quét ngược lịch sử: dữ liệu tồn từ trước ngày có luồng check-in đúng sẽ bị
 *   đánh dấu hàng loạt và mỗi bản ghi là 100% tiền của một người thật. Muốn dọn dữ liệu cũ
 *   thì chạy tay với `soNgay` lớn hơn sau khi đã đối chiếu.
 * @returns {Promise<{daDanhDau: number, boQua: object, chiTiet: Array}>}
 */
export async function quetNoShowHetCa({ now = new Date(), apply = true, soNgay = 1 } = {}) {
  const tu = startOfDayUtc(now)
  tu.setUTCDate(tu.getUTCDate() - (soNgay - 1))
  const den = startOfDayUtc(now)
  den.setUTCDate(den.getUTCDate() + 1)

  const ungVien = await LichHen.find({
    loai_kham: 'clinic',
    ngay_kham: { $gte: tu, $lt: den },
    status: { $in: TRANG_THAI_CO_THE_NO_SHOW },
  }).lean()

  const boQua = { chua_het_ca: 0, da_toi_quay: 0, ca_bi_nghi: 0, khong_ro_gio: 0 }
  if (ungVien.length === 0) return { daDanhDau: 0, boQua, chiTiet: [] }

  // Ai đã có mặt trong hàng đợi thì miễn nhiễm — kiểm bằng MỘT truy vấn cho cả lô.
  const daToiQuay = new Set(
    (await HangDoi.find({ appointment_id: { $in: ungVien.map((a) => a._id) } })
      .select('appointment_id').lean())
      .map((e) => String(e.appointment_id)),
  )

  const scheduleIds = ungVien.filter((a) => a.schedule_id).map((a) => a.schedule_id)
  const schedules = await LichLamViec.find({ _id: { $in: scheduleIds } })
    .select('slots trang_thai_ngay trang_thai_xac_nhan').lean()
  const scheduleById = new Map(schedules.map((s) => [String(s._id), s]))

  const chiTiet = []
  for (const appt of ungVien) {
    if (daToiQuay.has(String(appt._id))) { boQua.da_toi_quay++; continue }

    const schedule = appt.schedule_id ? scheduleById.get(String(appt.schedule_id)) : null
    if (caBiNghi(schedule, appt)) { boQua.ca_bi_nghi++; continue }

    const ketThuc = buildSlotDateTime(appt.ngay_kham, gioKetThucCa(schedule, appt.gio_kham))
    if (!ketThuc) { boQua.khong_ro_gio++; continue }
    if (now.getTime() < ketThuc.getTime()) { boQua.chua_het_ca++; continue }

    chiTiet.push({
      appointment_id: appt._id,
      ma_lich_hen: appt.ma_lich_hen ?? null,
      user_id: appt.user_id ?? null,
      doctor_id: appt.doctor_id ?? null,
      ngay_kham: appt.ngay_kham,
      gio_kham: appt.gio_kham,
      status_cu: appt.status,
      het_ca_luc: ketThuc,
    })
  }

  if (!apply || chiTiet.length === 0) {
    return { daDanhDau: 0, boQua, chiTiet }
  }

  const ids = chiTiet.map((c) => c.appointment_id)
  // Lọc lại `status` trong chính lệnh ghi: giữa lúc đọc và lúc ghi có thể có người vừa
  // check-in. Điều kiện ở đây là chốt cuối cùng, không phải kiểm tra cho đẹp.
  const kq = await LichHen.updateMany(
    { _id: { $in: ids }, status: { $in: TRANG_THAI_CO_THE_NO_SHOW } },
    { $set: { status: 'no_show', no_show_confirmed_at: now } },
  )

  await ghiNhatKy(chiTiet, now)
  await thongBaoChoKhach(chiTiet)

  return { daDanhDau: kq.modifiedCount ?? 0, boQua, chiTiet }
}

/** Nhật ký hệ thống — `no_show` là quyết định mất tiền, phải truy lại được vì sao. */
async function ghiNhatKy(chiTiet, now) {
  await NhatKyThaoTac.insertMany(
    chiTiet.map((c) => ({
      nguoi_thuc_hien_id: null, // vai_tro='system': cron tự động, không có người bấm
      vai_tro: 'system',
      hanh_dong: 'AUTO_MARK_NO_SHOW',
      loai_doi_tuong: 'appointment',
      doi_tuong_id: c.appointment_id,
      ly_do: `Hết ca lúc ${c.het_ca_luc.toISOString()} mà không có bản ghi hàng đợi (khách không tới quầy)`,
      du_lieu_cu: { status: c.status_cu },
      du_lieu_moi: { status: 'no_show', no_show_confirmed_at: now },
    })),
    { ordered: false },
  )
}

/**
 * Báo cho khách. Rule mục 5 không hoàn tiền trong trường hợp này, nên càng phải nói rõ —
 * mất tiền mà không được thông báo là cách nhanh nhất để có một khiếu nại.
 */
async function thongBaoChoKhach(chiTiet) {
  const coChuTaiKhoan = chiTiet.filter((c) => c.user_id)
  if (coChuTaiKhoan.length === 0) return

  await ThongBao.insertMany(
    coChuTaiKhoan.map((c) => ({
      user_id: c.user_id,
      tieu_de: 'Lịch hẹn được ghi nhận không đến',
      noi_dung: `Lịch hẹn ${c.ma_lich_hen ?? ''} lúc ${c.gio_kham} đã hết ca mà chưa thấy bạn tới quầy, `
        + 'nên được ghi nhận là không đến. Theo điều khoản đã đồng ý khi đặt, khoản thanh toán '
        + 'không được hoàn lại. Nếu có sai sót, vui lòng liên hệ phòng khám.',
      loai: 'appointment',
      related_id: c.appointment_id,
      related_type: 'lich_hen',
      ngay_gui_du_kien: new Date(),
    })),
    { ordered: false },
  )
}

/**
 * Bác sĩ của một lịch hẹn — dùng cho script kiểm tra/đối chiếu, không dùng trong luồng chính.
 * Tách riêng để `quetNoShowHetCa` không phải join thêm khi chạy mỗi 5 phút.
 */
export async function tenBacSiCuaLichHen(doctorId) {
  if (!doctorId) return null
  const bs = await BacSi.findById(doctorId).select('user_id').lean()
  if (!bs?.user_id) return null
  const nd = await NguoiDung.findById(bs.user_id).select('ho_ten').lean()
  return nd?.ho_ten ?? null
}
