import mongoose from 'mongoose'
import LichLamViec from '../../models/LichLamViec.js'
import { generateRollingWindowForAllDoctors } from '../../services/scheduleGenerator.service.js'
import { ok, fail } from '../../utils/response.js'

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

export async function createSchedule(req, res) {
  try {
    const { doctor_id, chi_nhanh_id, ngay, slots = [] } = req.body

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
