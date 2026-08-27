import mongoose from 'mongoose'

import { NghiPhepBacSi, BacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import {
  duyetDonNghi,
  tuChoiDonNghi,
  findLeaveByIdWithDoctor,
  moTaKetQuaDuyet,
} from '../../services/doctorLeaveApproval.service.js'

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
    gio_bat_dau: leave.gio_bat_dau ?? null,
    gio_ket_thuc: leave.gio_ket_thuc ?? null,
    ly_do: leave.ly_do ?? null,
    trang_thai: leave.trang_thai,
    nguon_tao: leave.nguon_tao ?? null,
    nguoi_duyet_id: leave.nguoi_duyet_id?._id ?? leave.nguoi_duyet_id ?? null,
    nguoi_duyet: leave.nguoi_duyet_id ? {
      _id: leave.nguoi_duyet_id._id ?? leave.nguoi_duyet_id,
      ho_ten: leave.nguoi_duyet_id.ho_ten ?? null,
    } : null,
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
      nguon_tao: 'admin_tao',
      nguoi_tao_id: req.user.id,
    })

    const populatedLeave = await findLeaveByIdWithDoctor(leave._id).lean()
    return created(res, formatDoctorLeave(populatedLeave), 'Tao don nghi phep thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}

export async function listDoctorLeaves(req, res) {
  try {
    const { bac_si_id, trang_thai, ngay, ten_bac_si, tu_ngay, den_ngay } = req.query
    const filter = {}

    if (bac_si_id) {
      if (!isValidObjectId(bac_si_id)) {
        return fail(res, 400, 'bac_si_id khong hop le')
      }
      filter.bac_si_id = bac_si_id
    }

    if (ten_bac_si) {
      const users = await mongoose.model('NguoiDung').find({ ho_ten: { $regex: ten_bac_si, $options: 'i' } }).select('_id')
      const userIds = users.map(u => u._id)
      const doctors = await mongoose.model('BacSi').find({ user_id: { $in: userIds } }).select('_id')
      const doctorIds = doctors.map(d => d._id)
      filter.bac_si_id = { $in: doctorIds }
    }

    if (trang_thai) {
      filter.trang_thai = trang_thai
    }

    if (tu_ngay || den_ngay) {
      filter.$and = []
      if (tu_ngay) {
        const start = new Date(tu_ngay)
        start.setHours(0, 0, 0, 0)
        filter.$and.push({ den_ngay: { $gte: start } })
      }
      if (den_ngay) {
        const end = new Date(den_ngay)
        end.setHours(23, 59, 59, 999)
        filter.$and.push({ tu_ngay: { $lte: end } })
      }
    } else if (ngay) {
      const targetDate = new Date(ngay)
      targetDate.setHours(0, 0, 0, 0)
      const targetDateEnd = new Date(targetDate)
      targetDateEnd.setHours(23, 59, 59, 999)
      
      filter.tu_ngay = { $lte: targetDateEnd }
      filter.den_ngay = { $gte: targetDate }
    }

    const leaves = await NghiPhepBacSi.find(filter)
      .populate({
        path: 'bac_si_id',
        select: 'user_id trang_thai',
        populate: { path: 'user_id', select: 'ho_ten' },
      })
      .populate({
        path: 'nguoi_duyet_id',
        select: 'ho_ten'
      })
      .sort({ ngay_tao: -1, _id: -1 })
      .lean()

    return ok(res, leaves.map(formatDoctorLeave))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function approveDoctorLeave(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID nghi phep khong hop le')
    }

    const leave = await NghiPhepBacSi.findById(id).session(session)
    if (!leave) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Khong tim thay don nghi phep')
    }

    const ghiChu = Object.prototype.hasOwnProperty.call(req.body, 'ghi_chu') ? req.body.ghi_chu : undefined
    const { slotsLocked, affectedAppointments, canDieuPhoiTaiQuay, deXuat } = await duyetDonNghi({
      leave,
      actorUserId: req.user.id,
      ghiChu,
      session,
    })

    await session.commitTransaction()
    session.endSession()

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(
      res,
      {
        ...formatDoctorLeave(populatedLeave),
        so_slot_da_khoa: slotsLocked,
        lich_hen_can_xu_ly: affectedAppointments.map((a) => ({
          id: a._id,
          ma_lich_hen: a.ma_lich_hen ?? null,
          ngay_kham: a.ngay_kham,
          gio_kham: a.gio_kham,
          status: a.status,
          ten_khach: a.ten_khach ?? null,
        })),
        can_dieu_phoi_tai_quay: canDieuPhoiTaiQuay,
        de_xuat_doi: deXuat,
        so_lich_cho_admin_duyet: deXuat.filter((d) => d.cho_admin_duyet).length,
        so_lich_khong_co_phuong_an: deXuat.filter((d) => d.so_phuong_an === 0).length,
      },
      moTaKetQuaDuyet(affectedAppointments.length, deXuat),
    )
  } catch (error) {
    await session.abortTransaction().catch(() => {})
    session.endSession()
    return fail(res, error.statusCode ?? 500, error.message)
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

    await tuChoiDonNghi({ leave, actorUserId: req.user.id, ghiChu: req.body.ghi_chu })

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(res, formatDoctorLeave(populatedLeave), 'Tu choi don nghi phep thanh cong')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
