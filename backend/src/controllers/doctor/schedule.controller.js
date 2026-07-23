import { BacSi, LichLamViec, LichHen, NhatKyThaoTac } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { thongKeLichHen } from '../../utils/appointmentStatus.js'

// ============================================================
// B2 — Quản lý lịch làm việc bác sĩ
// Routes: /api/doctor/schedule
// ============================================================

// FIX NHỎ ĐÃ XÁC NHẬN (Prompt 3, trực tiếp chặn màn lịch tuần frontend):
// LichLamViec.ngay được ghi bằng `new Date(str); x.setHours(0,0,0,0)` (scheduleGenerator.service.js
// và seed-doctor-test-data.js — cả 2 đều dùng pattern này) → lưu MỐC NỬA ĐÊM GIỜ ĐỊA PHƯƠNG (+7),
// tức lệch UTC. Đọc lại bằng `.toISOString().slice(0,10)` (UTC) luôn trả về NGÀY TRƯỚC 1 NGÀY so
// với ngày dự định — đã verify bằng phép tính trực tiếp (startOfDay('2026-07-20') → lưu
// 2026-07-19T17:00:00Z → toISOString().slice(0,10) = '2026-07-19', sai 1 ngày).
// Hệ quả thứ 2: filter from/to dùng `new Date(str)` (UTC midnight) sẽ làm rơi mất NGÀY ĐẦU của
// khoảng yêu cầu (vì tài liệu ngày đó lưu ở UTC midnight - 7 giờ, nhỏ hơn mốc $gte).
// Sửa bằng cách dùng lại ĐÚNG phép biến đổi "local start of day" mà phía ghi đã dùng — vừa cho
// đọc (serialize) vừa cho query (from/to) — để đối xứng với dữ liệu đã lưu. KHÔNG đổi cách ghi
// (generator/seed/admin ngoài phạm vi), KHÔNG đổi dữ liệu cũ trong MongoDB.
function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function localStartOfDay(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

// Trải mỗi document lịch (1 ngày) thành mảng slot phẳng cho FE. Bổ sung dữ liệu cấp NGÀY
// (y tá phụ trách, trạng thái ngày, chi nhánh) vào từng slot — các field này đã có trong DB,
// trước đây API không trả nên FE phải hardcode "Chưa phân công y tá" (xem docs/doctor-schedule-*).
function flattenSchedules(schedules) {
  return schedules.flatMap((sch) => {
    const nurse = sch.nurse_id // đã populate 'ho_ten'
    return sch.slots.map((s) => ({
      id:          s._id,
      schedule_id: sch._id,
      ngay:        localDateStr(sch.ngay),
      trang_thai_ngay: sch.trang_thai_ngay ?? null,
      chi_nhanh_id: sch.chi_nhanh_id ?? null,
      nurse_id:    nurse?._id ?? sch.nurse_id ?? null,
      nurse:       nurse?.ho_ten ?? null, // null = chưa phân công y tá (dữ liệu thật, không hardcode)
      gio_bat_dau:  s.gio_bat_dau,
      gio_ket_thuc: s.gio_ket_thuc,
      khung_index:  s.khung_index ?? null,
      loai_slot:    s.loai_slot ?? 'online',
      phong_kham:   s.phong_kham,
      status:       s.status,
      benh_nhan_id: s.benh_nhan_id?._id ?? s.benh_nhan_id ?? null,
      benh_nhan:    s.benh_nhan_id?.ho_ten ?? null,
      lock_expires_at:  s.lock_expires_at ?? null,
      cancel_requested: s.cancel_requested,
    }))
  })
}

// ─── GET /api/doctor/schedule?from=&to= ─────────────────────────────────────
export async function getSchedules(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { from, to } = req.query
    const dateFilter = {}
    if (from) dateFilter.$gte = localStartOfDay(from)
    if (to)   dateFilter.$lte = localStartOfDay(to)

    const filter = { doctor_id: doc._id }
    if (from || to) filter.ngay = dateFilter

    const schedules = await LichLamViec.find(filter)
      .populate('slots.benh_nhan_id', 'ho_ten')
      .populate('nurse_id', 'ho_ten')
      .sort({ ngay: 1 })
      .lean()

    return ok(res, flattenSchedules(schedules))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/schedule/:scheduleId ───────────────────────────────────
// Chi tiết 1 ca làm việc (1 ngày) của CHÍNH bác sĩ đăng nhập: thông tin ngày, y tá,
// danh sách slot, danh sách lịch hẹn thuộc ca (join tên BN online + khách vãng lai),
// và số liệu tổng hợp (đếm slot + đếm lịch hẹn theo nhóm). CHỈ ĐỌC — không ghi DB.
export async function getScheduleDetail(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    // Ownership: chỉ tìm ca thuộc bác sĩ đăng nhập → bác sĩ khác đổi URL sẽ nhận 404,
    // không lộ ca có tồn tại hay không.
    const schedule = await LichLamViec.findOne({ _id: req.params.scheduleId, doctor_id: doc._id })
      .populate('slots.benh_nhan_id', 'ho_ten')
      .populate('nurse_id', 'ho_ten')
      .lean()
    if (!schedule) return fail(res, 404, 'Không tìm thấy lịch làm việc')

    // Lịch hẹn thuộc ca này — dùng liên kết THẬT schedule_id (không suy luận theo giờ).
    const appointments = await LichHen.find({ schedule_id: schedule._id })
      .populate('user_id', 'ho_ten')
      .populate('member_id', 'ho_ten')
      .populate('specialty_id', 'ten')
      .sort({ gio_kham: 1 })
      .lean()

    const dsLichHen = appointments.map((a) => ({
      id:             a._id,
      ma_lich_hen:    a.ma_lich_hen ?? null,
      slot_id:        a.slot_id ?? null,
      // Ưu tiên tên thành viên → khách vãng lai (ten_khach) → chủ tài khoản. Khách offline
      // không có tài khoản vẫn hiển thị đúng tên (trước đây slot chỉ trả BN có tài khoản).
      benh_nhan:      a.member_id?.ho_ten ?? a.ten_khach ?? a.user_id?.ho_ten ?? 'Không rõ',
      gio_kham:       a.gio_kham,
      gio_ket_thuc:   a.gio_ket_thuc ?? null,
      loai_kham:      a.loai_kham,
      hinh_thuc_dat_lich: a.hinh_thuc_dat_lich ?? null,
      la_khach_vang_lai:  !!a.khach_vang_lai_id || (!a.member_id && !!a.ten_khach),
      chuyen_khoa:    a.specialty_id?.ten ?? null,
      ten_dich_vu:    a.ten_dich_vu ?? null,
      status:         a.status,
      payment_status: a.payment_status,
    }))

    const slots = (schedule.slots ?? []).map((s) => ({
      id:           s._id,
      gio_bat_dau:  s.gio_bat_dau,
      gio_ket_thuc: s.gio_ket_thuc,
      khung_index:  s.khung_index ?? null,
      loai_slot:    s.loai_slot ?? 'online',
      phong_kham:   s.phong_kham,
      status:       s.status,
      benh_nhan_id: s.benh_nhan_id?._id ?? s.benh_nhan_id ?? null,
      benh_nhan:    s.benh_nhan_id?.ho_ten ?? null,
      lock_expires_at:  s.lock_expires_at ?? null,
      cancel_requested: s.cancel_requested,
      bi_khoa_boi_nghi_phep: s.bi_khoa_boi_nghi_phep ?? false,
    }))

    const activeSlots = slots.filter((s) => s.status === 'active')
    const thong_ke = {
      tong_slot:    slots.length,
      slot_trong:   activeSlots.length,
      slot_da_dat:  slots.filter((s) => s.status === 'booked' || s.status === 'pending_payment').length,
      slot_bi_khoa: slots.filter((s) => s.status === 'locked').length,
      slot_da_huy:  slots.filter((s) => s.status === 'cancelled' || s.status === 'expired').length,
      // loai_slot co the thieu o du lieu cu (truoc migration) -> mac dinh coi la 'online'
      slot_online_trong: activeSlots.filter((s) => (s.loai_slot ?? 'online') !== 'walk_in').length,
      slot_walkin_trong:  activeSlots.filter((s) => s.loai_slot === 'walk_in').length,
      ...thongKeLichHen(appointments),
    }

    return ok(res, {
      id:              schedule._id,
      ngay:            localDateStr(schedule.ngay),
      trang_thai_ngay: schedule.trang_thai_ngay ?? null,
      ghi_chu_ngay:    schedule.ghi_chu_ngay ?? null,
      chi_nhanh_id:    schedule.chi_nhanh_id ?? null,
      nurse_id:        schedule.nurse_id?._id ?? schedule.nurse_id ?? null,
      nurse:           schedule.nurse_id?.ho_ten ?? null,
      slots,
      lich_hen:        dsLichHen,
      thong_ke,
    })
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
