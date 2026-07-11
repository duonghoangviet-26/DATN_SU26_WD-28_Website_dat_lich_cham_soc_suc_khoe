import mongoose from 'mongoose'
import LichLamViec from '../../models/LichLamViec.js'
import BacSi from '../../models/BacSi.js'
import { generateRollingWindowForAllDoctors } from '../../services/scheduleGenerator.service.js'
import { ok, fail } from '../../utils/response.js'

const DEFAULT_SLOT_TIMES = [
  ['08:00', '08:30'], ['08:30', '09:00'], ['09:00', '09:30'], ['09:30', '10:00'],
  ['10:00', '10:30'], ['10:30', '11:00'], ['11:00', '11:30'], ['11:30', '12:00'],
  ['13:30', '14:00'], ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
  ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'], ['17:00', '17:30'],
]

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

function formatDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function summarizeSlots(slots = []) {
  const firstSlot = slots[0] ?? null
  const lastSlot = slots[slots.length - 1] ?? null

  return {
    tong_slot: slots.length,
    slot_trong: slots.filter((slot) => slot.status === 'active').length,
    slot_da_dat: slots.filter((slot) => ['booked', 'pending_payment'].includes(slot.status)).length,
    slot_bi_khoa: slots.filter((slot) => slot.status === 'locked').length,
    slot_da_huy: slots.filter((slot) => ['cancelled', 'expired'].includes(slot.status)).length,
    gio_bat_dau: firstSlot?.gio_bat_dau ?? null,
    gio_ket_thuc: lastSlot?.gio_ket_thuc ?? null,
  }
}

function formatWorkday(schedule) {
  const slotSummary = summarizeSlots(schedule.slots)

  return {
    _id: schedule._id,
    doctor_id: schedule.doctor_id,
    chi_nhanh_id: schedule.chi_nhanh_id ?? null,
    ngay: formatDateOnly(schedule.ngay),
    trang_thai_ngay: schedule.trang_thai_ngay ?? 'lam_viec',
    ghi_chu_ngay: schedule.ghi_chu_ngay ?? null,
    co_di_lam: (schedule.trang_thai_ngay ?? 'lam_viec') === 'lam_viec',
    ...slotSummary,
  }
}

function buildDefaultSlots({ specialtyId = null, phongKham = null } = {}) {
  return DEFAULT_SLOT_TIMES.map(([gio_bat_dau, gio_ket_thuc]) => ({
    gio_bat_dau,
    gio_ket_thuc,
    specialty_id: specialtyId,
    phong_kham: phongKham,
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

    const schedules = await LichLamViec.find({
      doctor_id,
      ngay: { $gte: start, $lte: end },
    })
      .sort({ ngay: 1 })
      .lean()

    const byDate = new Map(schedules.map((schedule) => [formatDateOnly(schedule.ngay), schedule]))
    const items = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const key = formatDateOnly(cursor)
      const existing = byDate.get(key)

      if (existing) {
        items.push({
          ...formatWorkday(existing),
          nguon_lich: 'stored',
        })
      } else {
        const isSunday = cursor.getDay() === 0
        items.push({
          _id: null,
          doctor_id,
          chi_nhanh_id: doctor.chi_nhanh_id ?? null,
          ngay: key,
          trang_thai_ngay: isSunday ? 'nghi' : 'chua_tao',
          ghi_chu_ngay: isSunday ? 'Chu nhat' : null,
          co_di_lam: false,
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
    if (chi_nhanh_id && !mongoose.Types.ObjectId.isValid(chi_nhanh_id)) {
      return fail(res, 400, 'chi_nhanh_id khong hop le')
    }
    if (specialty_id && !mongoose.Types.ObjectId.isValid(specialty_id)) {
      return fail(res, 400, 'specialty_id khong hop le')
    }

    const workday = toDateOnly(ngay)
    if (workday.getUTCDay() === 0) {
      return fail(res, 400, 'Khong tu dong sinh lich vao Chu nhat')
    }

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
    if (trang_thai_ngay !== 'lam_viec' && hasBookedSlots) {
      return fail(res, 409, 'Khong the danh dau nghi khi van con khung gio da co benh nhan hoac dang cho thanh toan')
    }

    schedule.trang_thai_ngay = trang_thai_ngay
    schedule.ghi_chu_ngay = ghi_chu_ngay?.trim() || null
    await schedule.save()

    return ok(res, formatWorkday(schedule.toObject()), 'Cap nhat trang thai ngay thanh cong')
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
      result.skipped
        ? result.reason
        : `Da sinh lich ngay ${result.date.toISOString().slice(0, 10)} cho ${result.generated}/${result.total} bac si`
    )
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
