import 'dotenv/config'
import mongoose from 'mongoose'
import { BacSi, LichLamViec, NguoiDung } from '../models/index.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'

const DOCTOR_EMAIL = 'doctor.bao@vitafamily.vn'
const DEMO_MARKER = '[DEMO-CA-TOI-BS-BAO]'
const EVENING_WINDOWS = [
  ['18:00', '18:30'],
  ['18:30', '19:00'],
  ['19:00', '19:30'],
  ['19:30', '20:00'],
  ['20:00', '20:30'],
  ['20:30', '21:00'],
]
const LATE_EVENING_WINDOWS = [
  ['22:45', '23:15'],
  ['23:15', '23:45'],
]

function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function dateFromEnvOrDefault(value, fallback) {
  if (!value) return fallback
  const parsed = startOfDayUtc(value)
  if (!parsed) throw new Error(`DEMO_DATE không hợp lệ: ${value}`)
  return parsed
}

function buildEveningSlots(specialtyId, room, date, startIndex = 30, windows = EVENING_WINDOWS) {
  return windows.flatMap(([gioBatDau, gioKetThuc], index) => [
    {
      gio_bat_dau: gioBatDau,
      gio_ket_thuc: gioKetThuc,
      khung_index: startIndex + index,
      loai_slot: 'online',
      specialty_id: specialtyId,
      phong_kham: room,
      status: 'active',
      bi_khoa_boi_nghi_phep: false,
    },
    {
      gio_bat_dau: gioBatDau,
      gio_ket_thuc: gioKetThuc,
      khung_index: startIndex + index,
      loai_slot: 'walk_in',
      specialty_id: specialtyId,
      phong_kham: room,
      status: 'active',
      bi_khoa_boi_nghi_phep: false,
    },
  ])
}

async function upsertEveningSchedule({ doctor, date, startIndex, windows = EVENING_WINDOWS }) {
  let schedule = await LichLamViec.findOne({ doctor_id: doctor._id, ngay: date })
  const slots = buildEveningSlots(
    doctor.specialties[0],
    doctor.phong_kham_mac_dinh,
    date,
    startIndex,
    windows,
  )

  if (!schedule) {
    schedule = await LichLamViec.create({
      doctor_id: doctor._id,
      chi_nhanh_id: doctor.chi_nhanh_id ?? null,
      ngay: date,
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: 'da_xac_nhan',
      ghi_chu_ngay: DEMO_MARKER,
      slots,
    })
    return { schedule, created: slots.length, added: slots.length }
  }

  const existingKeys = new Set(schedule.slots.map((slot) => `${slot.gio_bat_dau}:${slot.loai_slot}`))
  const countByTime = new Map()
  for (const slot of schedule.slots) {
    const count = countByTime.get(slot.gio_bat_dau) ?? { online: 0, walk_in: 0 }
    if (slot.loai_slot === 'online' || slot.loai_slot === 'walk_in') count[slot.loai_slot] += 1
    countByTime.set(slot.gio_bat_dau, count)
  }
  const missing = slots.filter((slot) => {
    if (existingKeys.has(`${slot.gio_bat_dau}:${slot.loai_slot}`)) return false
    // Sau cutoff, slot online được hệ thống chuyển thành walk-in. Hai walk-in
    // cùng khung lúc đó vẫn là đúng công suất, không tạo thêm slot online mới.
    if (slot.loai_slot === 'online' && (countByTime.get(slot.gio_bat_dau)?.walk_in ?? 0) >= 2) return false
    return true
  })
  if (missing.length > 0) schedule.slots.push(...missing)
  let slotIndexChanged = false
  for (const slot of slots) {
    const existing = schedule.slots.filter((item) => item.gio_bat_dau === slot.gio_bat_dau && item.loai_slot === slot.loai_slot)
    for (const item of existing) {
      if (item.khung_index !== slot.khung_index) {
        item.khung_index = slot.khung_index
        slotIndexChanged = true
      }
    }
  }
  if (!schedule.ghi_chu_ngay?.includes(DEMO_MARKER)) {
    schedule.ghi_chu_ngay = [schedule.ghi_chu_ngay, DEMO_MARKER].filter(Boolean).join(' · ')
  }
  if (missing.length > 0 || slotIndexChanged || schedule.isModified('ghi_chu_ngay')) await schedule.save()

  return { schedule, created: 0, added: missing.length }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không chạy seed demo khi NODE_ENV=production')
  }
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI')

  await mongoose.connect(process.env.MONGODB_URI)
  const user = await NguoiDung.findOne({ email: DOCTOR_EMAIL, role: 'doctor' }).lean()
  if (!user) throw new Error(`Không tìm thấy tài khoản ${DOCTOR_EMAIL}`)

  const doctor = await BacSi.findOne({ user_id: user._id }).lean()
  if (!doctor) throw new Error('BS. Lê Quốc Bảo chưa có hồ sơ bác sĩ')
  if (doctor.trang_thai !== 'active' || doctor.trang_thai_duyet !== 'approved' || doctor.la_hien !== true) {
    throw new Error('BS. Lê Quốc Bảo chưa ở trạng thái active/approved/hiển thị')
  }
  if (!doctor.specialties?.[0]) throw new Error('BS. Lê Quốc Bảo chưa được gắn chuyên khoa')

  const now = new Date()
  const today = startOfDayUtc(now)
  const todayEveningStart = buildSlotDateTime(today, '22:45')
  const todayIsUsable = todayEveningStart && todayEveningStart.getTime() > now.getTime()
  const targetDate = dateFromEnvOrDefault(
    process.env.DEMO_DATE,
    todayIsUsable ? today : addDays(today, 1),
  )

  const first = await upsertEveningSchedule({
    doctor,
    date: targetDate,
    startIndex: targetDate.getTime() === today.getTime() ? 21 : 30,
    windows: targetDate.getTime() === today.getTime() ? LATE_EVENING_WINDOWS : EVENING_WINDOWS,
  })

  const tomorrow = addDays(today, 1)
  const second = targetDate.getTime() === tomorrow.getTime()
    ? null
    : await upsertEveningSchedule({ doctor, date: tomorrow, startIndex: 30, windows: EVENING_WINDOWS })

  const schedules = [first, second].filter(Boolean)
  console.log(JSON.stringify({
    success: true,
    doctor: { id: String(doctor._id), name: user.ho_ten, email: user.email },
    marker: DEMO_MARKER,
    schedules: schedules.map(({ schedule, created, added }) => ({
      id: String(schedule._id),
      date: schedule.ngay.toISOString().slice(0, 10),
      status: schedule.trang_thai_ngay,
      confirmation: schedule.trang_thai_xac_nhan,
      created,
      added,
      evening: schedule.slots
        .filter((slot) => slot.gio_bat_dau >= '18:00')
        .map((slot) => `${slot.gio_bat_dau}-${slot.gio_ket_thuc}:${slot.loai_slot}:${slot.status}`),
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(`Seed ca tối thất bại: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
