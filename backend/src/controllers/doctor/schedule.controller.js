import { BacSi, LichLamViec, LichHen } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// B2 — Quản lý lịch làm việc bác sĩ
// Routes: /api/doctor/schedule
// ============================================================

function flattenSchedules(schedules) {
  return schedules.flatMap((sch) =>
    sch.slots.map((s) => ({
      id:          s._id,
      schedule_id: sch._id,
      ngay:        sch.ngay.toISOString().slice(0, 10),
      gio_bat_dau:  s.gio_bat_dau,
      gio_ket_thuc: s.gio_ket_thuc,
      phong_kham:   s.phong_kham,
      status:       s.status,
      benh_nhan_id: s.benh_nhan_id,
      benh_nhan:    s.benh_nhan_id?.ho_ten ?? null,
    }))
  )
}

// ─── GET /api/doctor/schedule?from=&to= ─────────────────────────────────────
export async function getSchedules(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { from, to } = req.query
    const dateFilter = {}
    if (from) dateFilter.$gte = new Date(from)
    if (to)   dateFilter.$lte = new Date(to)

    const filter = { doctor_id: doc._id }
    if (from || to) filter.ngay = dateFilter

    const schedules = await LichLamViec.find(filter)
      .populate('slots.benh_nhan_id', 'ho_ten')
      .sort({ ngay: 1 })
      .lean()

    return ok(res, flattenSchedules(schedules))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/doctor/schedule ───────────────────────────────────────────────
// Body: { ngay, slots: [{ gio_bat_dau, gio_ket_thuc, phong_kham? }] }
export async function createSchedule(req, res) {
  try {
    const bacSi = await BacSi.findOne({ user_id: req.user.id })
    if (!bacSi) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { ngay, slots } = req.body
    if (!ngay)              return fail(res, 400, 'Ngày làm việc là bắt buộc')
    if (!Array.isArray(slots) || !slots.length) {
      return fail(res, 400, 'Phải có ít nhất 1 slot')
    }

    const ngayDate = new Date(ngay)
    if (isNaN(ngayDate)) return fail(res, 400, 'Ngày không hợp lệ')
    if (ngayDate < new Date().setHours(0, 0, 0, 0)) {
      return fail(res, 400, 'Không thể tạo lịch trong quá khứ')
    }

    const existing = await LichLamViec.findOne({ doctor_id: bacSi._id, ngay: ngayDate })
    if (existing) return fail(res, 409, 'Đã có lịch làm việc ngày này, hãy cập nhật thay vì tạo mới')

    const phongMacDinh = bacSi.phong_kham_mac_dinh
    const slotDocs = slots.map((s) => ({
      gio_bat_dau:  s.gio_bat_dau,
      gio_ket_thuc: s.gio_ket_thuc,
      phong_kham:   s.phong_kham ?? phongMacDinh,
      status:       'active',
    }))

    const schedule = await LichLamViec.create({
      doctor_id: bacSi._id,
      ngay:      ngayDate,
      slots:     slotDocs,
    })

    return created(res, flattenSchedules([schedule]), 'Tạo lịch làm việc thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/schedule/:scheduleId/slots/:slotId ───────────────────
// Cập nhật 1 slot (phong_kham, status: locked/active)
export async function updateSlot(req, res) {
  try {
    const bacSi = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!bacSi) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { scheduleId, slotId } = req.params
    const { phong_kham, status } = req.body

    const schedule = await LichLamViec.findOne({ _id: scheduleId, doctor_id: bacSi._id })
    if (!schedule) return fail(res, 404, 'Không tìm thấy lịch')

    const slot = schedule.slots.id(slotId)
    if (!slot) return fail(res, 404, 'Không tìm thấy slot')
    if (slot.status === 'booked') return fail(res, 409, 'Không thể sửa slot đã có bệnh nhân đặt')

    if (phong_kham !== undefined) {
      slot.phong_kham = phong_kham || null
      // Propagate sang lịch hẹn pending/confirmed liên quan
      await LichHen.updateMany(
        { schedule_id: scheduleId, slot_id: slotId, status: { $in: ['pending', 'confirmed'] } },
        { phong_kham: phong_kham || null },
      )
    }
    if (status && ['active', 'locked'].includes(status)) {
      slot.status = status
    }

    await schedule.save()
    return ok(res, {
      id:          slot._id,
      schedule_id: schedule._id,
      ngay:        schedule.ngay.toISOString().slice(0, 10),
      gio_bat_dau:  slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      phong_kham:   slot.phong_kham,
      status:       slot.status,
    }, 'Cập nhật slot thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── DELETE /api/doctor/schedule/:id ────────────────────────────────────────
// Xóa nguyên ngày nếu chưa có slot nào được đặt
export async function deleteSchedule(req, res) {
  try {
    const bacSi = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!bacSi) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const schedule = await LichLamViec.findOne({ _id: req.params.id, doctor_id: bacSi._id })
    if (!schedule) return fail(res, 404, 'Không tìm thấy lịch')

    const hasBooked = schedule.slots.some((s) => s.status === 'booked')
    if (hasBooked) return fail(res, 409, 'Không thể xóa lịch đã có bệnh nhân đặt')

    await schedule.deleteOne()
    return ok(res, null, 'Đã xóa lịch làm việc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
