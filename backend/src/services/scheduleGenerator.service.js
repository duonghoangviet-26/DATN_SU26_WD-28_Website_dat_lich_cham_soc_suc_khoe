import { BacSi, LichLamViec, LichSuChinhSuaLichLamViec } from '../models/index.js'

// Phan bo so slot ONLINE trong moi khung 30' cua 1 ca, xen ke theo dung vi du trong
// .claude/rules/lich-lam-viec-bac-si.md muc 4.3 (VD TMH ca sang 7 khung, online=10/14:
// [1,2,1,2,1,2,1]). Thuat toan: chia deu (base = floor(target/soKhung)), phan du duoc
// cong them vao cac khung LE (index 1,3,5,...) cho toi khi het du — dam bao xen ke thay
// vi don het vao dau/cuoi ca (tranh walk-in bi don het vao cuoi ca — xem muc 4.3).
// An toan: khong bao gio vuot qua soSlotMoiKhung (uu tien duoi tai neu lam tron gay du thua).
export function phanBoOnlineTheoKhung(soKhung, soSlotMoiKhung, tyLeOnlinePhanTram) {
  const tongSlot = soKhung * soSlotMoiKhung
  const targetOnline = Math.round((tongSlot * tyLeOnlinePhanTram) / 100)
  const base = Math.floor(targetOnline / soKhung)
  let conDu = targetOnline - base * soKhung

  const onlinePerKhung = []
  for (let i = 0; i < soKhung; i += 1) {
    let online = base
    if (conDu > 0 && i % 2 === 1) {
      online += 1
      conDu -= 1
    }
    onlinePerKhung.push(Math.min(online, soSlotMoiKhung))
  }
  return onlinePerKhung
}

// Weekly schedule generator for VitaFamily private clinic.
// The clinic works Monday -> Sunday and always excludes 11:30 -> 13:30.
export const DEFAULT_SLOT_TIMES = [
  ['08:00', '08:30'], ['08:30', '09:00'], ['09:00', '09:30'], ['09:30', '10:00'],
  ['10:00', '10:30'], ['10:30', '11:00'], ['11:00', '11:30'],
  ['13:30', '14:00'], ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
  ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'], ['17:00', '17:30'],
]

function startOfDateUTC(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function buildDefaultScheduleSlots({ specialtyId = null, phongKham = null } = {}) {
  return DEFAULT_SLOT_TIMES.map(([gio_bat_dau, gio_ket_thuc]) => ({
    gio_bat_dau,
    gio_ket_thuc,
    specialty_id: specialtyId,
    phong_kham: phongKham ?? null,
    status: 'active',
    benh_nhan_id: null,
    benh_nhan_tam_giu_id: null,
    lock_expires_at: null,
    pending_expired_at: null,
    cancel_requested: false,
    cancel_reason: null,
    bi_khoa_boi_nghi_phep: false,
    nghi_phep_id: null,
  }))
}

export function getWeekStart(value = new Date()) {
  const date = startOfDateUTC(value)
  const day = date.getUTCDay()
  const distanceToMonday = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + distanceToMonday)
  return date
}

export function getWeekDates(weekStart = new Date()) {
  const start = getWeekStart(weekStart)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date
  })
}

function getDoctorId(doctor) {
  return doctor?._id ?? doctor
}

function getFirstSpecialtyId(doctor) {
  return Array.isArray(doctor?.specialties) && doctor.specialties.length > 0
    ? doctor.specialties[0]
    : null
}

async function writeScheduleAudit({
  schedule,
  actorRole,
  actorUserId,
  action,
  note,
}) {
  await LichSuChinhSuaLichLamViec.create({
    schedule_id: schedule._id,
    doctor_id: schedule.doctor_id,
    ngay: schedule.ngay,
    nguoi_thuc_hien_id: actorUserId ?? null,
    vai_tro: actorRole,
    hanh_dong: action,
    du_lieu_cu: null,
    du_lieu_moi: {
      trang_thai_ngay: schedule.trang_thai_ngay,
      trang_thai_xac_nhan: schedule.trang_thai_xac_nhan,
      tong_slot: schedule.slots?.length ?? 0,
      gio_bat_dau: schedule.slots?.[0]?.gio_bat_dau ?? null,
      gio_ket_thuc: schedule.slots?.[schedule.slots.length - 1]?.gio_ket_thuc ?? null,
    },
    ghi_chu: note ?? null,
  })
}

async function generateSlotsForDoctorDate({
  doctor,
  date,
  actorRole = 'system',
  actorUserId = null,
  action = 'auto_generate',
  note = null,
}) {
  const doctorId = getDoctorId(doctor)
  const workday = startOfDateUTC(date)
  const existing = await LichLamViec.findOne({ doctor_id: doctorId, ngay: workday }).select('_id').lean()

  if (existing) {
    return { created: false, scheduleId: existing._id, reason: 'exists' }
  }

  try {
    const schedule = await LichLamViec.create({
      doctor_id: doctorId,
      chi_nhanh_id: doctor?.chi_nhanh_id ?? null,
      ngay: workday,
      trang_thai_ngay: 'lam_viec',
      ghi_chu_ngay: null,
      trang_thai_xac_nhan: 'cho_xac_nhan',
      slots: buildDefaultScheduleSlots({
        specialtyId: getFirstSpecialtyId(doctor),
        phongKham: doctor?.phong_kham_mac_dinh ?? null,
      }),
    })

    await writeScheduleAudit({
      schedule,
      actorRole,
      actorUserId,
      action,
      note,
    })

    return { created: true, scheduleId: schedule._id, reason: null }
  } catch (err) {
    if (err.code === 11000) {
      return { created: false, scheduleId: null, reason: 'duplicate_race' }
    }
    throw err
  }
}

export async function generateWeeklySchedule({
  weekStart = new Date(),
  doctors = null,
  actorRole = 'system',
  actorUserId = null,
  action = 'auto_generate',
  note = 'Sinh lịch làm việc tự động theo tuần',
} = {}) {
  const weekDates = getWeekDates(weekStart)
  const activeDoctors = doctors ?? await BacSi.find({
    trang_thai_duyet: 'approved',
    trang_thai: 'active',
    la_hien: true,
  })
    .select('_id chi_nhanh_id phong_kham_mac_dinh specialties')
    .lean()

  let generated = 0
  let skipped = 0
  const details = []

  for (const doctor of activeDoctors) {
    for (const date of weekDates) {
      const result = await generateSlotsForDoctorDate({
        doctor,
        date,
        actorRole,
        actorUserId,
        action,
        note,
      })

      if (result.created) generated += 1
      else skipped += 1

      details.push({
        doctor_id: getDoctorId(doctor),
        date,
        created: result.created,
        reason: result.reason,
      })
    }
  }

  return {
    week_start: weekDates[0],
    week_end: weekDates[6],
    days: weekDates.length,
    doctors: activeDoctors.length,
    generated,
    skipped,
    details,
  }
}

export async function generateAutoScheduleWindowForAllDoctors({
  fromDate = new Date(),
  weeksAhead = 2,
  action = 'auto_generate',
  note = 'Tự động sinh bù lịch làm việc',
} = {}) {
  const start = getWeekStart(fromDate)
  const weeks = Array.from({ length: weeksAhead + 1 }, (_, index) => {
    const weekStart = new Date(start)
    weekStart.setUTCDate(start.getUTCDate() + index * 7)
    return weekStart
  })

  const doctors = await BacSi.find({
    trang_thai_duyet: 'approved',
    trang_thai: 'active',
    la_hien: true,
  })
    .select('_id chi_nhanh_id phong_kham_mac_dinh specialties')
    .lean()

  const weeklyResults = []
  let generated = 0
  let skipped = 0

  for (const weekStart of weeks) {
    const result = await generateWeeklySchedule({
      weekStart,
      doctors,
      actorRole: 'system',
      action,
      note,
    })

    weeklyResults.push(result)
    generated += result.generated
    skipped += result.skipped
  }

  return {
    window_start: weeklyResults[0]?.week_start ?? start,
    window_end: weeklyResults[weeklyResults.length - 1]?.week_end ?? start,
    weeks: weeklyResults.length,
    doctors: doctors.length,
    generated,
    skipped,
    weekly_results: weeklyResults,
  }
}

export async function generateInitialWindowForDoctor(doctorId, phongMacDinh) {
  return generateWeeklySchedule({
    weekStart: new Date(),
    doctors: [{ _id: doctorId, phong_kham_mac_dinh: phongMacDinh }],
    action: 'auto_generate',
    note: 'Sinh lịch tự động khi duyệt bác sĩ',
  })
}

export async function generateRollingWindowForAllDoctors() {
  return generateAutoScheduleWindowForAllDoctors({
    fromDate: new Date(),
    weeksAhead: 2,
    action: 'auto_generate',
    note: 'Sinh lịch làm việc tự động định kỳ',
  })
}
