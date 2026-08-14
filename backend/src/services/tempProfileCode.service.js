import Counter from '../models/Counter.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

// D81 — mã định danh tạm cho hồ sơ bệnh nhân không có số điện thoại. Dùng CHUNG cơ chế
// Counter atomic đã có ở checkInNumber.service.js (capSoThuTuCheckin) để tránh đụng mã khi
// nhiều lễ tân tạo hồ sơ tạm cùng lúc.
export function buildTempCodeDayKey(now = new Date()) {
  return startOfDayUtc(now).toISOString().slice(0, 10)
}

export function buildTempCode(dayKey, sequence) {
  return `TEMP-${dayKey.replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`
}

export async function capMaTam(now = new Date()) {
  const dayKey = buildTempCodeDayKey(now)
  const sequence = await Counter.nextSeq(`ho-so-tam:${dayKey}`)
  return buildTempCode(dayKey, sequence)
}
