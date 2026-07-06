import mongoose from 'mongoose'

import { NghiPhepBacSi, BacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatDoctorLeave(leave) {
  return {
    _id: leave._id,
    bac_si_id: leave.bac_si_id?._id ?? leave.bac_si_id ?? null,
    bac_si: leave.bac_si_id
      ? {
          _id: leave.bac_si_id._id ?? leave.bac_si_id,
          user_id: leave.bac_si_id.user_id?._id ?? leave.bac_si_id.user_id ?? null,
          ho_ten: leave.bac_si_id.user_id?.ho_ten ?? null,
          trang_thai: leave.bac_si_id.trang_thai ?? null,
        }
      : null,
    tu_ngay: leave.tu_ngay,
    den_ngay: leave.den_ngay,
    ly_do: leave.ly_do ?? null,
    trang_thai: leave.trang_thai,
    nguoi_duyet_id: leave.nguoi_duyet_id ?? null,
    thoi_diem_duyet: leave.thoi_diem_duyet ?? null,
    ghi_chu: leave.ghi_chu ?? null,
    ngay_tao: leave.ngay_tao ?? null,
    ngay_cap_nhat: leave.ngay_cap_nhat ?? null,
  }
}

async function ensureDoctorExists(bacSiId) {
  if (!isValidObjectId(bacSiId)) {
    throw new Error('bac_si_id khong hop le')
  }

  const doctor = await BacSi.findById(bacSiId).select('_id')
  if (!doctor) {
    throw new Error('Khong tim thay bac si')
  }

  return doctor
}

function findLeaveByIdWithDoctor(id) {
  return NghiPhepBacSi.findById(id)
    .populate({
      path: 'bac_si_id',
      select: 'user_id trang_thai',
      populate: { path: 'user_id', select: 'ho_ten' },
    })
}

export async function createDoctorLeave(req, res) {
  try {
    const { bac_si_id, tu_ngay, den_ngay, ly_do, ghi_chu } = req.body

    if (!bac_si_id || !tu_ngay || !den_ngay) {
      return fail(res, 400, 'bac_si_id, tu_ngay va den_ngay la bat buoc')
    }

    await ensureDoctorExists(bac_si_id)

    const leave = await NghiPhepBacSi.create({
      bac_si_id,
      tu_ngay: new Date(tu_ngay),
      den_ngay: new Date(den_ngay),
      ly_do: ly_do ?? null,
      ghi_chu: ghi_chu ?? null,
    })

    const populatedLeave = await findLeaveByIdWithDoctor(leave._id).lean()
    return created(res, formatDoctorLeave(populatedLeave), 'Tao don nghi phep thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}

export async function listDoctorLeaves(req, res) {
  try {
    const { bac_si_id, trang_thai } = req.query
    const filter = {}

    if (bac_si_id) {
      if (!isValidObjectId(bac_si_id)) {
        return fail(res, 400, 'bac_si_id khong hop le')
      }
      filter.bac_si_id = bac_si_id
    }

    if (trang_thai) {
      filter.trang_thai = trang_thai
    }

    const leaves = await NghiPhepBacSi.find(filter)
      .populate({
        path: 'bac_si_id',
        select: 'user_id trang_thai',
        populate: { path: 'user_id', select: 'ho_ten' },
      })
      .sort({ ngay_tao: -1, _id: -1 })
      .lean()

    return ok(res, leaves.map(formatDoctorLeave))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function approveDoctorLeave(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID nghi phep khong hop le')
    }

    const leave = await NghiPhepBacSi.findById(id)
    if (!leave) {
      return fail(res, 404, 'Khong tim thay don nghi phep')
    }

    leave.trang_thai = 'da_duyet'
    leave.nguoi_duyet_id = req.user.id
    leave.thoi_diem_duyet = new Date()
    if (Object.prototype.hasOwnProperty.call(req.body, 'ghi_chu')) {
      leave.ghi_chu = req.body.ghi_chu
    }
    await leave.save()

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(res, formatDoctorLeave(populatedLeave), 'Duyet don nghi phep thanh cong')
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function rejectDoctorLeave(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID nghi phep khong hop le')
    }

    const leave = await NghiPhepBacSi.findById(id)
    if (!leave) {
      return fail(res, 404, 'Khong tim thay don nghi phep')
    }

    leave.trang_thai = 'tu_choi'
    leave.nguoi_duyet_id = req.user.id
    leave.thoi_diem_duyet = new Date()
    leave.ghi_chu = req.body.ghi_chu || leave.ghi_chu
    await leave.save()

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(res, formatDoctorLeave(populatedLeave), 'Tu choi don nghi phep thanh cong')
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
