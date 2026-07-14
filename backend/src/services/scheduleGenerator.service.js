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

// Chuẩn hoá 1 ngày lịch về mốc 00:00:00Z (UTC-midnight của đúng ngày lịch đó) — ĐỘC LẬP múi giờ
// tiến trình. Đây là điểm mấu chốt chống GAP-8: dù seed (+7) hay cron (UTC) gọi, kết quả luôn là
// cùng một instant 00:00Z cho cùng một ngày → find/upsert theo {doctor_id, ngay} không bao giờ
// tạo bản trùng. Kết hợp process.env.TZ='UTC' (src/config/timezone.js) để việc chọn "ngày nào"
// cũng nhất quán. Xem docs/doctor-schedule-database-gap-analysis.md.
function toScheduleDayUTC(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

// Sinh lịch cho 1 bác sĩ + 1 ngày cụ thể — CHOKE POINT DUY NHẤT ghi LichLamViec (cron, admin
// trigger, duyệt BS mới đều đi qua đây). Idempotent theo ngày lịch (không theo instant thô).
async function generateSlotsForDoctorDate(doctorId, rawDate, phongMacDinh) {
  const ngay = toScheduleDayUTC(rawDate)

  const slots = SLOT_TIMES.map(([gio_bat_dau, gio_ket_thuc]) => ({
    gio_bat_dau,
    gio_ket_thuc,
    phong_kham: phongMacDinh ?? null,
    status: 'active',
  }))

  try {
    // Upsert idempotent: chỉ tạo slot khi CHƯA có document cho ngày đó ($setOnInsert) — không bao
    // giờ ghi đè slot của ngày đã tồn tại. Cùng unique index {doctor_id, ngay} → an toàn cả khi
    // 2 tiến trình chạy đồng thời (race → E11000 được nuốt, coi như đã có).
    const res = await LichLamViec.updateOne(
      { doctor_id: doctorId, ngay },
      { $setOnInsert: { trang_thai_ngay: 'lam_viec', ghi_chu_ngay: null, slots } },
      { upsert: true },
    )
    return res.upsertedCount > 0
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
