import { BacSi, LichLamViec } from '../models/index.js'

// ============================================================
// SINH LỊCH LÀM VIỆC TỰ ĐỘNG (B2 — Rolling Window T2–T7)
// Dùng chung bởi: cron 23:55 hàng ngày, POST /api/admin/slots/generate,
// và services/doctor.service.js.approveDoctor() (sinh lịch lần đầu cho BS mới duyệt).
// Xem docs/Bác sĩ/B2 - Lịch làm việc.md mục 2.
// ============================================================

// 16 slot/ngày, nghỉ trưa 12:00–13:30 (TBD-1 = C, đã chốt trong doc)
const SLOT_TIMES = [
  ['08:00', '08:30'], ['08:30', '09:00'], ['09:00', '09:30'], ['09:30', '10:00'],
  ['10:00', '10:30'], ['10:30', '11:00'], ['11:00', '11:30'], ['11:30', '12:00'],
  ['13:30', '14:00'], ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
  ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'], ['17:00', '17:30'],
]

// Lịch chỉ sinh T2–T7 — bỏ Chủ nhật (getDay() === 0)
function isWorkingDay(date) {
  return date.getDay() !== 0
}

// Sinh lịch cho 1 bác sĩ + 1 ngày cụ thể — bỏ qua nếu đã tồn tại (idempotent)
async function generateSlotsForDoctorDate(doctorId, date, phongMacDinh) {
  const existing = await LichLamViec.findOne({ doctor_id: doctorId, ngay: date }).select('_id').lean()
  if (existing) return false

  const slots = SLOT_TIMES.map(([gio_bat_dau, gio_ket_thuc]) => ({
    gio_bat_dau,
    gio_ket_thuc,
    phong_kham: phongMacDinh ?? null,
    status: 'active',
  }))

  try {
    await LichLamViec.create({ doctor_id: doctorId, ngay: date, slots })
    return true
  } catch (err) {
    if (err.code === 11000) return false // race condition — đã có ai tạo trước, bỏ qua
    throw err
  }
}

// 6 ngày làm việc (T2–T7) kể từ hôm nay — dùng khi BS mới được duyệt
function getRollingWindowDates() {
  const dates = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (dates.length < 6) {
    if (isWorkingDay(cursor)) dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

// Sinh lịch 6 ngày đầu cho 1 bác sĩ vừa được Admin duyệt (B2 doc mục 2.4)
export async function generateInitialWindowForDoctor(doctorId, phongMacDinh) {
  const dates = getRollingWindowDates()
  for (const d of dates) {
    await generateSlotsForDoctorDate(doctorId, d, phongMacDinh)
  }
}

// Sinh lịch ngày T+7 cho toàn bộ bác sĩ đã duyệt — cron 23:55 hoặc admin trigger thủ công
// (B2 doc mục 2.3: "Nếu cron fail → Admin có thể trigger thủ công qua POST /api/admin/slots/generate")
export async function generateRollingWindowForAllDoctors() {
  const target = new Date()
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 7)

  if (!isWorkingDay(target)) {
    return { date: target, generated: 0, total: 0, skipped: true, reason: 'Chủ nhật — không sinh lịch' }
  }

  const doctors = await BacSi.find({ trang_thai_duyet: 'approved' })
    .select('_id phong_kham_mac_dinh')
    .lean()

  let generated = 0
  for (const doc of doctors) {
    const created = await generateSlotsForDoctorDate(doc._id, target, doc.phong_kham_mac_dinh)
    if (created) generated += 1
  }

  return { date: target, generated, total: doctors.length, skipped: false }
}
