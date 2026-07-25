import { BacSi, LichLamViec, LichSuChinhSuaLichLamViec, ChuyenKhoa } from '../models/index.js'

// Phan bo so slot ONLINE trong moi khung 30' cua 1 ca, xen ke theo dung vi du trong
// .claude/rules/lich-lam-viec-bac-si.md muc 4.3 (VD TMH ca sang 7 khung, online=10/14:
// [1,2,1,2,1,2,1]). Thuat toan 2-buoc: (1) Phan bo deu (base = floor(target/soKhung))
// cho tat ca khung. (2) Phan du: Buoc 1 cong +1 vao khung LE (index 1,3,5,...), Buoc 2
// (neu con du) cong +1 vao khung CHAN (index 0,2,4,...) — dam bao xen ke va dat dung
// target. An toan: luon dat dung gia tri target, khong bao gio vuot qua soSlotMoiKhung.
export function phanBoOnlineTheoKhung(soKhung, soSlotMoiKhung, tyLeOnlinePhanTram) {
  const tongSlot = soKhung * soSlotMoiKhung
  const targetOnline = Math.round((tongSlot * tyLeOnlinePhanTram) / 100)
  const base = Math.floor(targetOnline / soKhung)
  let conDu = targetOnline - base * soKhung

  const onlinePerKhung = new Array(soKhung).fill(base)
  // Buoc 1: cong du vao khung LE truoc (giu dung xen ke nhu vi du dac ta muc 4.3).
  // Buoc 2: neu con du (VD ty_le_online cao, > ~57-64% tuy soKhung), vong qua khung CHAN
  // de PHAN BO HET conDu — sua loi "roi mat phan du" cua ban dau (chi cong vao khung le
  // se lam thieu hut online khi conDu > so khung le co san). Ca 2 buoc luon du cho de hap
  // thu het conDu (conDu < soKhung theo tinh chat phep chia lay du, tong suc chua 2 buoc = soKhung).
  for (let pass = 0; pass < 2 && conDu > 0; pass += 1) {
    const parityCanNhan = pass === 0 ? 1 : 0
    for (let i = 0; i < soKhung && conDu > 0; i += 1) {
      if (i % 2 !== parityCanNhan) continue
      if (onlinePerKhung[i] >= soSlotMoiKhung) continue
      onlinePerKhung[i] += 1
      conDu -= 1
    }
  }
  return onlinePerKhung.map((online) => Math.min(online, soSlotMoiKhung))
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

// Ca sang = DEFAULT_SLOT_TIMES[0..6] (7 khung), ca chieu = DEFAULT_SLOT_TIMES[7..14] (8 khung).
const CA_SANG_SO_KHUNG = 7
const CA_CHIEU_SO_KHUNG = 8

export async function buildDefaultScheduleSlots({ specialtyId = null, phongKham = null } = {}) {
  // Fallback khi khong co specialtyId (vd bac si chua gan chuyen khoa): giu dung hanh vi
  // CU truoc migration nay — 1 slot/khung, tat ca deu online.
  const config = specialtyId
    ? await ChuyenKhoa.findById(specialtyId).select('so_slot_moi_khung ty_le_online_phan_tram').lean()
    : null
  const soSlotMoiKhung = config?.so_slot_moi_khung ?? 1
  const tyLeOnline = config?.ty_le_online_phan_tram ?? 100

  const onlinePerKhungSang = phanBoOnlineTheoKhung(CA_SANG_SO_KHUNG, soSlotMoiKhung, tyLeOnline)
  const onlinePerKhungChieu = phanBoOnlineTheoKhung(CA_CHIEU_SO_KHUNG, soSlotMoiKhung, tyLeOnline)
  const onlinePerKhung = [...onlinePerKhungSang, ...onlinePerKhungChieu]

  const slots = []
  DEFAULT_SLOT_TIMES.forEach(([gio_bat_dau, gio_ket_thuc], khungIndex) => {
    const soOnlineTrongKhung = onlinePerKhung[khungIndex]
    for (let i = 0; i < soSlotMoiKhung; i += 1) {
      slots.push({
        gio_bat_dau,
        gio_ket_thuc,
        khung_index: khungIndex,
        loai_slot: i < soOnlineTrongKhung ? 'online' : 'walk_in',
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
      })
    }
  })
  return slots
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
      slots: await buildDefaultScheduleSlots({
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
