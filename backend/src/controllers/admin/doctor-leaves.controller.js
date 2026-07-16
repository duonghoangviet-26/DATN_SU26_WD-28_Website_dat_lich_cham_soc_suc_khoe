import mongoose from 'mongoose'

import { NghiPhepBacSi, BacSi, LichLamViec, LichHen } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { AFFECTED_BY_LEAVE_STATUSES } from '../../utils/appointmentStatus.js'

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

// Khóa các slot 'active' của bác sĩ trong khoảng ngày nghỉ đã duyệt — dùng field
// bi_khoa_boi_nghi_phep/nghi_phep_id đã có sẵn trong schema (KHÔNG đổi model).
// Slot đã booked/pending_payment KHÔNG bị đụng — Admin tự xử lý thủ công (không tự hủy lịch BN).
// Nghỉ CẢ NGÀY (không giới hạn khung giờ): đánh dấu trang_thai_ngay='nghi_phep' để getSlots
// (đặt lịch bệnh nhân) loại cả ngày qua điều kiện đã có sẵn — không cần sửa booking.controller.js
// cho trường hợp này. Nghỉ theo khung giờ: giữ trang_thai_ngay='lam_viec', chỉ khóa slot giao giờ.
async function lockSlotsForLeave(leave, session) {
  const endExclusive = new Date(leave.den_ngay)
  endExclusive.setDate(endExclusive.getDate() + 1)

  const schedules = await LichLamViec.find({
    doctor_id: leave.bac_si_id,
    ngay: { $gte: leave.tu_ngay, $lt: endExclusive },
  }).session(session)

  let slotsLocked = 0

  for (const schedule of schedules) {
    let changed = false

    for (const slot of schedule.slots) {
      const inRange = !leave.gio_bat_dau || !leave.gio_ket_thuc
        ? true
        : slot.gio_bat_dau < leave.gio_ket_thuc && slot.gio_ket_thuc > leave.gio_bat_dau
      if (!inRange || slot.status !== 'active') continue

      slot.status = 'locked'
      slot.bi_khoa_boi_nghi_phep = true
      slot.nghi_phep_id = leave._id
      slotsLocked += 1
      changed = true
    }

    if (!leave.gio_bat_dau && schedule.trang_thai_ngay === 'lam_viec') {
      schedule.trang_thai_ngay = 'nghi_phep'
      changed = true
    }

    if (changed) await schedule.save({ session })
  }

  return { slotsLocked }
}

// Lịch hẹn CÒN HIỆU LỰC trong khoảng nghỉ (+ khung giờ nếu có) — trả cho Admin biết cần
// liên hệ bệnh nhân xử lý (dời lịch/hoàn tiền). CHỈ ĐỌC, không tự hủy/sửa lịch hẹn.
async function findAffectedAppointments(leave, session) {
  const endExclusive = new Date(leave.den_ngay)
  endExclusive.setDate(endExclusive.getDate() + 1)

  let appointments = await LichHen.find({
    doctor_id: leave.bac_si_id,
    status: { $in: AFFECTED_BY_LEAVE_STATUSES },
    ngay_kham: { $gte: leave.tu_ngay, $lt: endExclusive },
  }).select('ma_lich_hen ngay_kham gio_kham status ten_khach').session(session).lean()

  if (leave.gio_bat_dau && leave.gio_ket_thuc) {
    appointments = appointments.filter((a) => a.gio_kham >= leave.gio_bat_dau && a.gio_kham < leave.gio_ket_thuc)
  }
  return appointments
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
    if (leave.trang_thai !== 'cho_duyet') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Chi duyet duoc don dang cho duyet')
    }

    leave.trang_thai = 'da_duyet'
    leave.nguoi_duyet_id = req.user.id
    leave.thoi_diem_duyet = new Date()
    if (Object.prototype.hasOwnProperty.call(req.body, 'ghi_chu')) {
      leave.ghi_chu = req.body.ghi_chu
    }
    await leave.save({ session })

    const { slotsLocked } = await lockSlotsForLeave(leave, session)
    const affectedAppointments = await findAffectedAppointments(leave, session)

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
      },
      affectedAppointments.length > 0
        ? `Duyet don nghi phep thanh cong. Co ${affectedAppointments.length} lich hen can Admin lien he xu ly.`
        : 'Duyet don nghi phep thanh cong',
    )
  } catch (error) {
    await session.abortTransaction().catch(() => {})
    session.endSession()
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
    if (leave.trang_thai !== 'cho_duyet') {
      return fail(res, 409, 'Chi tu choi duoc don dang cho duyet')
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
