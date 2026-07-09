import { BacSi, LichLamViec, NhatKyThaoTac } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

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
      cancel_requested: s.cancel_requested,
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

// ─── POST /api/doctor/schedule/:scheduleId/slots/:slotId/request-cancel ─────
// F7 — bác sĩ yêu cầu hủy 1 slot đã có bệnh nhân đặt. Slot giữ nguyên 'booked'
// cho đến khi Admin xử lý (liên hệ BN, dời lịch hoặc hoàn tiền) — B2 doc mục F7.
export async function requestCancelSlot(req, res) {
  try {
    const bacSi = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!bacSi) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { ly_do } = req.body
    if (!ly_do?.trim()) return fail(res, 400, 'Bắt buộc nhập lý do hủy')

    const { scheduleId, slotId } = req.params
    const schedule = await LichLamViec.findOne({ _id: scheduleId, doctor_id: bacSi._id })
    if (!schedule) return fail(res, 404, 'Không tìm thấy lịch')

    const slot = schedule.slots.id(slotId)
    if (!slot) return fail(res, 404, 'Không tìm thấy slot')
    if (slot.status !== 'booked') return fail(res, 409, 'Chỉ yêu cầu hủy slot đã có bệnh nhân đặt')
    if (slot.cancel_requested) return fail(res, 409, 'Đã gửi yêu cầu hủy cho slot này, đang chờ Admin xử lý')

    slot.cancel_requested = true
    slot.cancel_reason    = ly_do.trim()
    await schedule.save()

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro:            'doctor',
      hanh_dong:           'CANCEL_SLOT',
      loai_doi_tuong:      'doctor_schedule',
      doi_tuong_id:        schedule._id,
      ly_do:               ly_do.trim(),
    })

    return ok(res, { id: slot._id, cancel_requested: true }, 'Đã gửi yêu cầu hủy — chờ Admin xử lý')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
