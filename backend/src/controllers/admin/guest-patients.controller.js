import mongoose from 'mongoose'

import { KhachVangLai, LichHen } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatGuestPatient(guestPatient, history = null) {
  const data = {
    _id: guestPatient._id,
    ho_ten: guestPatient.ho_ten,
    so_dien_thoai: guestPatient.so_dien_thoai,
    ngay_sinh: guestPatient.ngay_sinh ?? null,
    gioi_tinh: guestPatient.gioi_tinh ?? null,
    dia_chi: guestPatient.dia_chi ?? null,
    ghi_chu: guestPatient.ghi_chu ?? null,
    created_by: guestPatient.created_by ?? null,
    ngay_tao: guestPatient.ngay_tao ?? null,
    ngay_cap_nhat: guestPatient.ngay_cap_nhat ?? null,
  }

  if (history) {
    data.lich_su_lich_hen = history
  }

  return data
}

async function loadAppointmentHistory(guestPatientId) {
  const appointments = await LichHen.find({ khach_vang_lai_id: guestPatientId })
    .sort({ ngay_kham: -1, gio_kham: -1 })
    .lean()

  return appointments.map((appointment) => ({
    _id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    status: appointment.status,
    payment_status: appointment.payment_status,
    chi_nhanh_id: appointment.chi_nhanh_id ?? null,
    specialty_id: appointment.specialty_id ?? null,
  }))
}

export async function createGuestPatient(req, res) {
  try {
    const { ho_ten, so_dien_thoai, ngay_sinh, gioi_tinh, dia_chi, ghi_chu } = req.body

    if (!ho_ten?.trim() || !so_dien_thoai?.trim()) {
      return fail(res, 400, 'ho_ten va so_dien_thoai la bat buoc')
    }

    const guestPatient = await KhachVangLai.create({
      ho_ten: ho_ten.trim(),
      so_dien_thoai: so_dien_thoai.trim(),
      ngay_sinh: ngay_sinh ? new Date(ngay_sinh) : null,
      gioi_tinh: gioi_tinh ?? null,
      dia_chi: dia_chi ?? null,
      ghi_chu: ghi_chu ?? null,
      created_by: req.user?.id ?? null,
    })

    return created(res, formatGuestPatient(guestPatient.toObject()), 'Tao khach vang lai thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}

export async function listGuestPatients(req, res) {
  try {
    const { so_dien_thoai } = req.query
    const filter = {}

    if (so_dien_thoai) {
      filter.so_dien_thoai = so_dien_thoai.trim()
    }

    const guestPatients = await KhachVangLai.find(filter)
      .sort({ ngay_tao: -1, _id: -1 })
      .lean()

    return ok(res, guestPatients.map((guestPatient) => formatGuestPatient(guestPatient)))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getGuestPatientById(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID khach vang lai khong hop le')
    }

    const guestPatient = await KhachVangLai.findById(id).lean()
    if (!guestPatient) {
      return fail(res, 404, 'Khong tim thay khach vang lai')
    }

    const history = await loadAppointmentHistory(id)
    return ok(res, formatGuestPatient(guestPatient, history))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function updateGuestPatient(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID khach vang lai khong hop le')
    }

    const guestPatient = await KhachVangLai.findById(id)
    if (!guestPatient) {
      return fail(res, 404, 'Khong tim thay khach vang lai')
    }

    const allowedFields = ['ho_ten', 'so_dien_thoai', 'ngay_sinh', 'gioi_tinh', 'dia_chi', 'ghi_chu']
    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue

      if (field === 'ngay_sinh') {
        guestPatient.ngay_sinh = req.body.ngay_sinh ? new Date(req.body.ngay_sinh) : null
      } else if (typeof req.body[field] === 'string') {
        guestPatient[field] = req.body[field].trim()
      } else {
        guestPatient[field] = req.body[field]
      }
    }

    await guestPatient.save()
    return ok(res, formatGuestPatient(guestPatient.toObject()), 'Cap nhat khach vang lai thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}
