import { LichLamViec } from '../models/index.js'

// ============================================================
// Phạm vi bác sĩ y tá phụ trách "hôm nay" — dùng chung queue + room-status.
// "Hôm nay" tính local server time (setHours), KHÔNG dùng UTC — khớp pattern
// đã dùng ở nurse/appointments.controller.js và nurse/dashboard.controller.js.
// ============================================================

export function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export async function getMyDoctorIdsToday(nurseId) {
  const { start, end } = getTodayRange()
  const ids = await LichLamViec.find({ nurse_id: nurseId, ngay: { $gte: start, $lt: end } }).distinct('doctor_id')
  return ids.map(String)
}
