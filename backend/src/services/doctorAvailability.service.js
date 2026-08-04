import { LichLamViec } from '../models/index.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'

// Dùng chung giữa bác sĩ (doctor/queue.controller.js) và lễ tân (queueTransfer.service.js) —
// "đang trong ca làm việc" nghĩa là CÓ khung giờ (bất kỳ chuyên khoa nào) mà [gio_bat_dau, gio_ket_thuc)
// chứa thời điểm `now`. Tách ra đây để tránh 2 nơi định nghĩa khác nhau cùng một khái niệm.
export function getTodayRange(now = new Date()) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

// Giữ ĐÚNG hành vi gốc từ doctor/queue.controller.js (không thêm điều kiện) — hàm này chỉ
// trả lời "có khung nào chứa `now`", KHÔNG xét khung đó có bị khoá nghỉ phép hay không.
// Constraint "không bị khoá nghỉ phép" là một kiểm tra RIÊNG (xem queueTransfer.service.js)
// vì hai nơi gọi hàm này (bác sĩ tự thao tác vs lễ tân chuyển lượt) muốn thông báo lỗi khác nhau.
export async function bacSiDangTrongCaLamViec(doctorId, now = new Date()) {
  const { start, end } = getTodayRange(now)
  const schedules = await LichLamViec.find({
    doctor_id: doctorId,
    ngay: { $gte: start, $lt: end },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  }).select('ngay slots').lean()

  return schedules.some((schedule) => schedule.slots.some((slot) => {
    const batDau = buildSlotDateTime(schedule.ngay, slot.gio_bat_dau)
    const ketThuc = buildSlotDateTime(schedule.ngay, slot.gio_ket_thuc)
    return batDau && ketThuc && now >= batDau && now < ketThuc
  }))
}

// Constraint riêng cho E-4: khung giờ HIỆN TẠI của bác sĩ đích có bị khoá vì nghỉ phép không.
// Trả về true nếu TẤT CẢ khung chứa `now` đều bị khoá (hoặc không có khung nào chứa `now`
// nhưng bác sĩ có lịch hôm nay — coi là chưa tới giờ, không chặn ở đây, để constraint 3 xử lý).
export async function khungHienTaiBiKhoaNghiPhep(doctorId, now = new Date()) {
  const { start, end } = getTodayRange(now)
  const schedule = await LichLamViec.findOne({
    doctor_id: doctorId,
    ngay: { $gte: start, $lt: end },
  }).select('ngay slots').lean()
  if (!schedule) return false

  const khungHienTai = schedule.slots.filter((slot) => {
    const batDau = buildSlotDateTime(schedule.ngay, slot.gio_bat_dau)
    const ketThuc = buildSlotDateTime(schedule.ngay, slot.gio_ket_thuc)
    return batDau && ketThuc && now >= batDau && now < ketThuc
  })
  if (khungHienTai.length === 0) return false
  return khungHienTai.every((slot) => slot.bi_khoa_boi_nghi_phep)
}

// Phòng của bác sĩ ở khung giờ HIỆN TẠI (phòng gắn với CA, không gắn với ngày — rule mục 10) —
// dùng để cập nhật `phong_kham` khi chuyển lượt sang bác sĩ khác (E-4 constraint 6).
export async function phongKhamHienTaiCuaBacSi(doctorId, now = new Date()) {
  const { start, end } = getTodayRange(now)
  const schedule = await LichLamViec.findOne({
    doctor_id: doctorId,
    ngay: { $gte: start, $lt: end },
  }).select('ngay slots').lean()
  if (!schedule) return null

  const slotHienTai = schedule.slots.find((slot) => {
    const batDau = buildSlotDateTime(schedule.ngay, slot.gio_bat_dau)
    const ketThuc = buildSlotDateTime(schedule.ngay, slot.gio_ket_thuc)
    return batDau && ketThuc && now >= batDau && now < ketThuc
  })
  return slotHienTai?.phong_kham ?? null
}
