import Counter from '../models/Counter.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

export function buildCheckInDayKey(now = new Date()) {
  return startOfDayUtc(now).toISOString().slice(0, 10)
}

export function buildCheckInCode(dayKey, sequence) {
  return `CK-${dayKey.replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`
}

export async function capSoThuTuCheckin(now = new Date()) {
  const ngay_checkin_key = buildCheckInDayKey(now)
  const so_thu_tu_checkin = await Counter.nextSeq(`checkin:${ngay_checkin_key}`)

  return {
    ngay_checkin_key,
    so_thu_tu_checkin,
    ma_so_thu_tu: buildCheckInCode(ngay_checkin_key, so_thu_tu_checkin),
  }
}
