import mongoose from 'mongoose'
import LichLamViec from '../../models/LichLamViec.js'
import BacSi from '../../models/BacSi.js'
import LichHen from '../../models/LichHen.js'
import LichSuChinhSuaLichLamViec from '../../models/LichSuChinhSuaLichLamViec.js'
import { buildDefaultScheduleSlots, generateRollingWindowForAllDoctors } from '../../services/scheduleGenerator.service.js'
import { ok, fail } from '../../utils/response.js'

const APPOINTMENT_CONFLICT_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress']
const APPOINTMENT_OCCUPIED_SLOT_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'no_show',
]
const MAX_CALENDAR_RANGE_DAYS = 42
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidObjectId(value) {
  return value === null || value === undefined || mongoose.Types.ObjectId.isValid(value)
}

function normalizeSlotPayload(slot) {
  if (!slot?.gio_bat_dau || !slot?.gio_ket_thuc) {
    throw new Error('Slot bat buoc co gio_bat_dau va gio_ket_thuc')
  }

  const normalized = {
    gio_bat_dau: slot.gio_bat_dau,
    gio_ket_thuc: slot.gio_ket_thuc,
    benh_nhan_id: slot.benh_nhan_id ?? null,
    benh_nhan_tam_giu_id: slot.benh_nhan_tam_giu_id ?? null,
    specialty_id: slot.specialty_id ?? null,
    phong_kham: slot.phong_kham ?? null,
    status: slot.status ?? 'active',
    lock_expires_at: slot.lock_expires_at ?? null,
    pending_expired_at: slot.pending_expired_at ?? null,
    cancel_requested: slot.cancel_requested ?? false,
    cancel_reason: slot.cancel_reason ?? null,
    bi_khoa_boi_nghi_phep: slot.bi_khoa_boi_nghi_phep ?? false,
    nghi_phep_id: slot.nghi_phep_id ?? null,
  }

  for (const field of ['benh_nhan_id', 'benh_nhan_tam_giu_id', 'specialty_id', 'nghi_phep_id']) {
    if (!isValidObjectId(normalized[field])) {
      throw new Error(`${field} khong hop le`)
    }
  }

  return normalized
}

function toDateOnly(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && formatDateOnly(parsed) === value
}

function formatDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function summarizeSlots(slots = [], occupiedAppointmentCount = 0) {
  const firstSlot = slots[0] ?? null
  const lastSlot = slots[slots.length - 1] ?? null
  const bookedBySlotStatus = slots.filter((slot) => ['booked', 'pending_payment'].includes(slot.status)).length
  const occupiedSlots = Math.max(bookedBySlotStatus, occupiedAppointmentCount)
  const lockedSlots = slots.filter((slot) => slot.status === 'locked').length
  const unavailableSlots = slots.filter((slot) => ['cancelled', 'expired'].includes(slot.status)).length

  return {
    tong_slot: slots.length,
    slot_trong: Math.max(0, slots.length - occupiedSlots - lockedSlots - unavailableSlots),
    slot_da_dat: occupiedSlots,
    slot_bi_khoa: lockedSlots,
    slot_da_huy: unavailableSlots,
    gio_bat_dau: firstSlot?.gio_bat_dau ?? null,
    gio_ket_thuc: lastSlot?.gio_ket_thuc ?? null,
  }
}

function formatWorkday(schedule, appointmentStats = {}) {
  const occupiedAppointmentCount = appointmentStats.occupied ?? 0
  const processingAppointmentCount = appointmentStats.processing ?? 0
  const slotSummary = summarizeSlots(schedule.slots, occupiedAppointmentCount)
  const confirmationStatus = schedule.trang_thai_xac_nhan ?? 'cho_xac_nhan'

  return {
    _id: schedule._id,
    doctor_id: schedule.doctor_id,
    chi_nhanh_id: schedule.chi_nhanh_id ?? null,
    ngay: formatDateOnly(schedule.ngay),
    trang_thai_ngay: schedule.trang_thai_ngay ?? 'lam_viec',
    ghi_chu_ngay: schedule.ghi_chu_ngay ?? null,
    trang_thai_xac_nhan: confirmationStatus,
    ly_do_tu_choi_xac_nhan: schedule.ly_do_tu_choi_xac_nhan ?? null,
    thoi_diem_xac_nhan: schedule.thoi_diem_xac_nhan ?? null,
    co_di_lam: (schedule.trang_thai_ngay ?? 'lam_viec') === 'lam_viec',
    so_lich_hen_xung_dot: processingAppointmentCount,
    canh_bao_xung_dot_xac_nhan: confirmationStatus === 'tu_choi' && processingAppointmentCount > 0,
    ...slotSummary,
  }
}

function buildAppointmentStatsBySchedule(schedules, appointments) {
  const scheduleById = new Map(schedules.map((schedule) => [String(schedule._id), schedule]))
  const statsByScheduleId = new Map()

  for (const schedule of schedules) {
    statsByScheduleId.set(String(schedule._id), { occupied: 0, processing: 0 })
  }

  for (const appointment of appointments) {
    let schedule = appointment.schedule_id
      ? scheduleById.get(String(appointment.schedule_id))
      : null

    if (!schedule) {
      const appointmentDate = formatDateOnly(appointment.ngay_kham)
      schedule = schedules.find((candidate) => {
        if (String(candidate.doctor_id) !== String(appointment.doctor_id)) return false
        if (formatDateOnly(candidate.ngay) !== appointmentDate) return false
        return candidate.slots?.some((slot) => slot.gio_bat_dau === appointment.gio_kham)
      })
    }

    if (!schedule) continue

    const key = String(schedule._id)
    const current = statsByScheduleId.get(key) ?? { occupied: 0, processing: 0 }

    if (APPOINTMENT_OCCUPIED_SLOT_STATUSES.includes(appointment.status)) {
      current.occupied += 1
    }
    if (APPOINTMENT_CONFLICT_STATUSES.includes(appointment.status)) {
      current.processing += 1
    }

    statsByScheduleId.set(key, current)
  }

  return statsByScheduleId
}

function buildDefaultSlots({ specialtyId = null, phongKham = null } = {}) {
  return buildDefaultScheduleSlots({ specialtyId, phongKham })
}

function compactSlot(slot) {
  if (!slot) return null
  return {
    _id: slot._id,
    gio_bat_dau: slot.gio_bat_dau,
    gio_ket_thuc: slot.gio_ket_thuc,
    phong_kham: slot.phong_kham ?? null,
    status: slot.status,
    specialty_id: slot.specialty_id ?? null,
    benh_nhan_id: slot.benh_nhan_id ?? null,
    benh_nhan_tam_giu_id: slot.benh_nhan_tam_giu_id ?? null,
  }
}

function compactSchedule(schedule) {
  if (!schedule) return null
  const plain = typeof schedule.toObject === 'function' ? schedule.toObject() : schedule
  return {
    _id: plain._id,
    doctor_id: plain.doctor_id,
    chi_nhanh_id: plain.chi_nhanh_id ?? null,
    ngay: plain.ngay,
    trang_thai_ngay: plain.trang_thai_ngay,
    ghi_chu_ngay: plain.ghi_chu_ngay ?? null,
    trang_thai_xac_nhan: plain.trang_thai_xac_nhan ?? 'cho_xac_nhan',
    ly_do_tu_choi_xac_nhan: plain.ly_do_tu_choi_xac_nhan ?? null,
    tong_slot: plain.slots?.length ?? 0,
    gio_bat_dau: plain.slots?.[0]?.gio_bat_dau ?? null,
    gio_ket_thuc: plain.slots?.[plain.slots.length - 1]?.gio_ket_thuc ?? null,
  }
}

async function writeScheduleAudit({
  schedule,
  slotId = null,
  user,
  action,
  before = null,
  after = null,
  note = null,
}) {
  await LichSuChinhSuaLichLamViec.create({
    schedule_id: schedule?._id ?? null,
    doctor_id: schedule?.doctor_id ?? null,
    ngay: schedule?.ngay ?? null,
    slot_id: slotId,
    nguoi_thuc_hien_id: user?.id ?? null,
    vai_tro: user?.role ?? 'admin',
    hanh_dong: action,
    du_lieu_cu: before,
    du_lieu_moi: after,
    ghi_chu: note,
  })
}

function formatAuditLog(log) {
  return {
    _id: log._id,
    schedule_id: log.schedule_id ?? null,
    doctor_id: log.doctor_id?._id ?? log.doctor_id ?? null,
    doctor_name: log.doctor_id?.user_id?.ho_ten ?? null,
    ngay: log.ngay ? formatDateOnly(log.ngay) : null,
    slot_id: log.slot_id ?? null,
    nguoi_thuc_hien_id: log.nguoi_thuc_hien_id?._id ?? log.nguoi_thuc_hien_id ?? null,
    nguoi_thuc_hien: log.nguoi_thuc_hien_id?.ho_ten ?? (log.vai_tro === 'system' ? 'Hệ thống' : 'Không rõ'),
    nguoi_thuc_hien_email: log.nguoi_thuc_hien_id?.email ?? null,
    vai_tro: log.vai_tro,
    hanh_dong: log.hanh_dong,
    du_lieu_cu: log.du_lieu_cu ?? null,
    du_lieu_moi: log.du_lieu_moi ?? null,
    ghi_chu: log.ghi_chu ?? null,
    thoi_diem: log.thoi_diem,
  }
}

export async function createSchedule(req, res) {
  try {
    const { doctor_id, chi_nhanh_id, ngay, slots = [], trang_thai_ngay, ghi_chu_ngay } = req.body

    if (!doctor_id || !mongoose.Types.ObjectId.isValid(doctor_id)) {
      return fail(res, 400, 'doctor_id khong hop le')
    }
    if (!ngay) {
      return fail(res, 400, 'ngay la bat buoc')
    }
    if (chi_nhanh_id && !mongoose.Types.ObjectId.isValid(chi_nhanh_id)) {
      return fail(res, 400, 'chi_nhanh_id khong hop le')
    }
    if (!Array.isArray(slots)) {
      return fail(res, 400, 'slots phai la mang')
    }

    const schedule = await LichLamViec.create({
      doctor_id,
      chi_nhanh_id: chi_nhanh_id ?? null,
      ngay: new Date(ngay),
      trang_thai_ngay: trang_thai_ngay ?? 'lam_viec',
      ghi_chu_ngay: ghi_chu_ngay?.trim() || null,
      slots: slots.map(normalizeSlotPayload),
    })

    await writeScheduleAudit({
      schedule,
      user: req.user,
      action: 'manual_create',
      after: compactSchedule(schedule),
      note: 'Admin tạo lịch làm việc thủ công',
    })

    return res.status(201).json({
      success: true,
      message: 'Tao lich lam viec thanh cong',
      data: schedule.toObject(),
    })
  } catch (err) {
    const status = err.code === 11000 || err.message.includes('bat buoc') || err.message.includes('hop le')
      ? 400
      : 500
    return fail(res, status, err.message)
  }
}

export async function getDoctorWorkdays(req, res) {
  try {
    const { doctor_id, from, to } = req.query

    if (!doctor_id || !mongoose.Types.ObjectId.isValid(doctor_id)) {
      return fail(res, 400, 'doctor_id khong hop le')
    }
    if ((from && !isValidDateOnly(from)) || (to && !isValidDateOnly(to))) {
      return fail(res, 400, 'from va to phai co dinh dang YYYY-MM-DD hop le')
    }

    const doctor = await BacSi.findById(doctor_id)
      .populate('user_id', 'ho_ten')
      .lean()

    if (!doctor) {
      return fail(res, 404, 'Khong tim thay bac si')
    }

    const start = from ? toDateOnly(from) : toDateOnly(new Date())
    const end = to ? toDateOnly(to) : toDateOnly(new Date(Date.now() + 13 * 24 * 60 * 60 * 1000))

    if (end < start) {
      return fail(res, 400, 'Khoang ngay khong hop le')
    }
    const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (rangeDays > MAX_CALENDAR_RANGE_DAYS) {
      return fail(res, 400, `Khoang ngay toi da la ${MAX_CALENDAR_RANGE_DAYS} ngay`)
    }

    const schedules = await LichLamViec.find({
      doctor_id,
      ngay: { $gte: start, $lte: end },
    })
      .sort({ ngay: 1 })
      .lean()

    const appointments = await LichHen.find({
      doctor_id,
      ngay_kham: { $gte: start, $lte: end },
      status: { $in: APPOINTMENT_OCCUPIED_SLOT_STATUSES },
    })
      .select('doctor_id schedule_id slot_id ngay_kham gio_kham status')
      .lean()
    const appointmentStatsByScheduleId = buildAppointmentStatsBySchedule(schedules, appointments)
    const byDate = new Map(schedules.map((schedule) => [formatDateOnly(schedule.ngay), schedule]))
    const items = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const key = formatDateOnly(cursor)
      const existing = byDate.get(key)

      if (existing) {
        items.push({
          ...formatWorkday(existing, appointmentStatsByScheduleId.get(String(existing._id))),
          nguon_lich: 'stored',
        })
      } else {
        items.push({
          _id: null,
          doctor_id,
          chi_nhanh_id: doctor.chi_nhanh_id ?? null,
          ngay: key,
          trang_thai_ngay: 'chua_tao',
          ghi_chu_ngay: null,
          trang_thai_xac_nhan: 'cho_xac_nhan',
          ly_do_tu_choi_xac_nhan: null,
          thoi_diem_xac_nhan: null,
          co_di_lam: false,
          so_lich_hen_xung_dot: 0,
          canh_bao_xung_dot_xac_nhan: false,
          tong_slot: 0,
          slot_trong: 0,
          slot_da_dat: 0,
          slot_bi_khoa: 0,
          slot_da_huy: 0,
          gio_bat_dau: null,
          gio_ket_thuc: null,
          nguon_lich: 'derived',
        })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    return ok(res, {
      doctor: {
        _id: doctor._id,
        ten: doctor.user_id?.ho_ten ?? 'Khong ro',
      },
      range: {
        from: formatDateOnly(start),
        to: formatDateOnly(end),
      },
      items,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function ensureDoctorWorkday(req, res) {
  try {
    const { doctor_id, ngay, chi_nhanh_id, specialty_id, phong_kham, trang_thai_ngay, ghi_chu_ngay } = req.body

    if (!doctor_id || !mongoose.Types.ObjectId.isValid(doctor_id)) {
      return fail(res, 400, 'doctor_id khong hop le')
    }
    if (!ngay) {
      return fail(res, 400, 'ngay la bat buoc')
    }
    if (!isValidDateOnly(ngay)) {
      return fail(res, 400, 'ngay phai co dinh dang YYYY-MM-DD hop le')
    }
    if (chi_nhanh_id && !mongoose.Types.ObjectId.isValid(chi_nhanh_id)) {
      return fail(res, 400, 'chi_nhanh_id khong hop le')
    }
    if (specialty_id && !mongoose.Types.ObjectId.isValid(specialty_id)) {
      return fail(res, 400, 'specialty_id khong hop le')
    }

    const workday = toDateOnly(ngay)

    const doctor = await BacSi.findById(doctor_id).lean()
    if (!doctor) {
      return fail(res, 404, 'Khong tim thay bac si')
    }

    const existing = await LichLamViec.findOne({ doctor_id, ngay: workday })
    if (existing) {
      return ok(res, {
        ...formatWorkday(existing.toObject()),
        nguon_lich: 'stored',
        reused: true,
      }, 'Ngay nay da co lich lam viec')
    }

    const fallbackSpecialtyId = specialty_id ?? doctor.specialties?.[0] ?? null
    const schedule = await LichLamViec.create({
      doctor_id,
      chi_nhanh_id: chi_nhanh_id ?? doctor.chi_nhanh_id ?? null,
      ngay: workday,
      trang_thai_ngay: trang_thai_ngay ?? 'lam_viec',
      ghi_chu_ngay: ghi_chu_ngay?.trim() || null,
      slots: buildDefaultSlots({
        specialtyId: fallbackSpecialtyId,
        phongKham: phong_kham ?? doctor.phong_kham_mac_dinh ?? null,
      }),
    })

    await writeScheduleAudit({
      schedule,
      user: req.user,
      action: 'manual_create',
      after: compactSchedule(schedule),
      note: 'Admin chạy bù lịch cho ngày trống',
    })

    return res.status(201).json({
      success: true,
      message: 'Da sinh lich lam viec tu dong cho ngay trong',
      data: {
        ...formatWorkday(schedule.toObject()),
        nguon_lich: 'stored',
        reused: false,
      },
    })
  } catch (err) {
    const status = err.code === 11000 ? 409 : 500
    return fail(res, status, err.message)
  }
}

export async function getScheduleById(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, 'id khong hop le')
    }

    const schedule = await LichLamViec.findById(id).lean()
    if (!schedule) {
      return fail(res, 404, 'Khong tim thay lich lam viec')
    }

    const appointments = await LichHen.find({
      doctor_id: schedule.doctor_id,
      status: { $in: APPOINTMENT_OCCUPIED_SLOT_STATUSES },
      $or: [
        { schedule_id: schedule._id },
        { ngay_kham: schedule.ngay },
      ],
    }).select('slot_id gio_kham').lean()
    const occupiedSlotIds = new Set(appointments.map((appointment) => String(appointment.slot_id)).filter(Boolean))
    const occupiedTimes = new Set(appointments.map((appointment) => appointment.gio_kham).filter(Boolean))
    schedule.slots = schedule.slots.map((slot) => ({
      ...slot,
      co_lich_hen: occupiedSlotIds.has(String(slot._id)) || occupiedTimes.has(slot.gio_bat_dau),
    }))

    return ok(res, schedule, 'Lay lich lam viec thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function updateSlot(req, res) {
  try {
    const { id, slotId } = req.params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(slotId)) {
      return fail(res, 400, 'id hoac slotId khong hop le')
    }

    const schedule = await LichLamViec.findById(id)
    if (!schedule) {
      return fail(res, 404, 'Khong tim thay lich lam viec')
    }

    const slot = schedule.slots.id(slotId)
    if (!slot) {
      return fail(res, 404, 'Khong tim thay slot')
    }

    const before = compactSlot(slot.toObject())

    const changesProtectedField = ['gio_bat_dau', 'gio_ket_thuc', 'phong_kham', 'status'].some(
      (field) => req.body[field] !== undefined && String(req.body[field] ?? '') !== String(slot[field] ?? '')
    )
    if (changesProtectedField) {
      const hasAppointment = await LichHen.exists({
        doctor_id: schedule.doctor_id,
        status: { $in: APPOINTMENT_OCCUPIED_SLOT_STATUSES },
        $or: [
          { schedule_id: schedule._id, slot_id: slot._id },
          { ngay_kham: schedule.ngay, gio_kham: slot.gio_bat_dau },
        ],
      })
      if (hasAppointment) {
        return fail(res, 409, 'Khong the chinh sua slot da co lich hen')
      }
    }

    // Slot đang bị khóa bởi nghỉ phép đã duyệt (bi_khoa_boi_nghi_phep=true) — không cho đổi
    // status ngầm mà không tường minh bỏ khóa trước, tránh admin vô tình "mở lại" slot đã khóa
    // hợp lệ (vd sửa tay status='active') trong khi bác sĩ vẫn đang nghỉ (xem docs/Bác sĩ/Audit
    // tong the, GAP-010). Đổi bi_khoa_boi_nghi_phep=false trong CÙNG request thì vẫn cho phép.
    if (slot.bi_khoa_boi_nghi_phep && req.body.status !== undefined && req.body.status !== slot.status) {
      const dangBoKhoa = req.body.bi_khoa_boi_nghi_phep === false
      if (!dangBoKhoa) {
        return fail(res, 409, 'Slot đang bị khóa bởi nghỉ phép đã duyệt — phải gửi kèm bi_khoa_boi_nghi_phep=false để xác nhận bỏ khóa trước khi đổi trạng thái')
      }
    }

    const updatableFields = [
      'gio_bat_dau',
      'gio_ket_thuc',
      'benh_nhan_id',
      'benh_nhan_tam_giu_id',
      'specialty_id',
      'phong_kham',
      'status',
      'lock_expires_at',
      'pending_expired_at',
      'cancel_requested',
      'cancel_reason',
      'bi_khoa_boi_nghi_phep',
      'nghi_phep_id',
    ]

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        if (['benh_nhan_id', 'benh_nhan_tam_giu_id', 'specialty_id', 'nghi_phep_id'].includes(field) && !isValidObjectId(req.body[field])) {
          return fail(res, 400, `${field} khong hop le`)
        }
        slot[field] = req.body[field]
      }
    }

    await schedule.save()

    const updatedSlot = schedule.slots.id(slotId)
    await writeScheduleAudit({
      schedule,
      slotId,
      user: req.user,
      action: 'update_slot',
      before,
      after: compactSlot(updatedSlot.toObject()),
      note: 'Admin cập nhật slot khám',
    })

    return ok(res, schedule.toObject(), 'Cap nhat slot thanh cong')
  } catch (err) {
    const status = err.message.includes('phai') || err.message.includes('hop le') ? 400 : 500
    return fail(res, status, err.message)
  }
}

export async function updateWorkday(req, res) {
  try {
    const { id } = req.params
    const { trang_thai_ngay, ghi_chu_ngay } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, 'id khong hop le')
    }

    if (!['lam_viec', 'nghi', 'nghi_phep'].includes(trang_thai_ngay)) {
      return fail(res, 400, 'trang_thai_ngay khong hop le')
    }

    const schedule = await LichLamViec.findById(id)
    if (!schedule) {
      return fail(res, 404, 'Khong tim thay lich lam viec')
    }

    const hasBookedSlots = schedule.slots.some((slot) => ['booked', 'pending_payment'].includes(slot.status))
    const hasAppointments = trang_thai_ngay === 'lam_viec' ? false : await LichHen.exists({
      doctor_id: schedule.doctor_id,
      status: { $in: APPOINTMENT_OCCUPIED_SLOT_STATUSES },
      $or: [
        { schedule_id: schedule._id },
        { ngay_kham: schedule.ngay },
      ],
    })
    if (trang_thai_ngay !== 'lam_viec' && (hasBookedSlots || hasAppointments)) {
      return fail(res, 409, 'Khong the danh dau nghi khi van con khung gio da co benh nhan hoac dang cho thanh toan')
    }

    const before = compactSchedule(schedule)
    schedule.trang_thai_ngay = trang_thai_ngay
    schedule.ghi_chu_ngay = ghi_chu_ngay?.trim() || null
    await schedule.save()

    await writeScheduleAudit({
      schedule,
      user: req.user,
      action: 'update_workday',
      before,
      after: compactSchedule(schedule),
      note: 'Admin cập nhật trạng thái ngày làm việc',
    })

    return ok(res, formatWorkday(schedule.toObject()), 'Cap nhat trang thai ngay thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getAuditLogs(req, res) {
  try {
    const {
      schedule_id,
      doctor_id,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query

    const filter = {}

    if (schedule_id) {
      if (!mongoose.Types.ObjectId.isValid(schedule_id)) {
        return fail(res, 400, 'schedule_id khong hop le')
      }
      filter.schedule_id = schedule_id
    }

    if (doctor_id) {
      if (!mongoose.Types.ObjectId.isValid(doctor_id)) {
        return fail(res, 400, 'doctor_id khong hop le')
      }
      filter.doctor_id = doctor_id
    }

    if (from || to) {
      filter.ngay = {}
      if (from) filter.ngay.$gte = toDateOnly(from)
      if (to) filter.ngay.$lte = toDateOnly(to)
    }

    const currentPage = Math.max(1, Number(page) || 1)
    const perPage = Math.min(100, Math.max(5, Number(limit) || 20))
    const skip = (currentPage - 1) * perPage

    const [logs, total] = await Promise.all([
      LichSuChinhSuaLichLamViec.find(filter)
        .populate('nguoi_thuc_hien_id', 'ho_ten email')
        .populate({
          path: 'doctor_id',
          select: 'user_id',
          populate: { path: 'user_id', select: 'ho_ten' },
        })
        .sort({ thoi_diem: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      LichSuChinhSuaLichLamViec.countDocuments(filter),
    ])

    return ok(res, {
      items: logs.map(formatAuditLog),
      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    }, 'Lay lich su chinh sua lich lam viec thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function generate(req, res) {
  try {
    const result = await generateRollingWindowForAllDoctors()
    return ok(
      res,
      result,
      `Da sinh/bu lich tu dong ${result.window_start.toISOString().slice(0, 10)} - ${result.window_end.toISOString().slice(0, 10)}: tao moi ${result.generated}, bo qua ${result.skipped}`
    )
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
