import mongoose from 'mongoose'

import { LichHen, LichLamViec } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { isSlotInPast, quaSatGioBatDau } from '../../utils/clinicTime.js'
import {
  guiThongBaoDeXuat, nhaChoDaGiu, chonPhuongAnTuDo, slotConTrong, GIO_HAN_PHAN_HOI,
} from '../../services/appointmentReschedule.service.js'

// ============================================================
// DUYỆT PHƯƠNG ÁN DỜI LỊCH — phía Admin / Lễ tân
// Routes: /api/admin/reschedule-approvals, /api/receptionist/reschedule-approvals
// ============================================================
// Rule mục 15 (chốt 2026-08-22): khung đã có khách ĐÃ THANH TOÁN thì bác sĩ chỉ được TẠO
// YÊU CẦU, lễ tân hoặc admin duyệt rồi mới thông báo khách. Tiền của khách không để một
// người tự định đoạt. Trước 2026-08-22 chỉ Admin duyệt được, nhưng không có UI admin nào
// gọi API này nên các đề xuất bị kẹt tới khi cron tự áp sau `GIO_HAN_PHAN_HOI_ADMIN` — nay
// mở thêm cho lễ tân (người trực tiếp xử lý luồng báo nghỉ/liên hệ khách ở phòng khám nhỏ).

function fmt(appointment) {
  const dx = appointment.de_xuat_doi
  return {
    id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen,
    ten_khach: appointment.ten_khach,
    so_dien_thoai_khach: appointment.so_dien_thoai_khach,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    doctor_id: appointment.doctor_id,
    gia_kham: appointment.gia_kham,
    payment_status: appointment.payment_status,
    de_xuat: {
      trang_thai: dx?.trang_thai ?? null,
      han_phan_hoi: dx?.han_phan_hoi ?? null,
      ghi_chu: dx?.ghi_chu ?? null,
      phuong_an: (dx?.phuong_an ?? []).map((pa, index) => ({
        index,
        loai: pa.loai,
        mo_ta: pa.mo_ta,
        ngay: pa.ngay,
        gio_bat_dau: pa.gio_bat_dau,
        bac_si_ten: pa.bac_si_ten ?? null,
        da_giu_cho: Boolean(pa.da_giu_cho),
        // Lấn slot khách-tới-quầy là ngoại lệ duy nhất của mục 15 — admin phải thấy rõ
        // mình đang duyệt cái gì.
        lan_walk_in: Boolean(pa.lan_walk_in),
      })),
    },
  }
}

// ─── GET /api/admin/reschedule-approvals ────────────────────────────────────
export async function list(req, res) {
  try {
    const danhSach = await LichHen.find({ 'de_xuat_doi.trang_thai': 'cho_admin_duyet' })
      .sort({ ngay_kham: 1, gio_kham: 1 })
      .lean()

    return ok(res, danhSach.map(fmt))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reschedule-approvals/:id/approve ──────────────────────
// Duyệt xong thì chuyển sang `cho_khach_chon` và báo khách — admin duyệt PHƯƠNG ÁN,
// không chọn thay khách. Khách vẫn giữ nguyên quyền chọn của mình (rule mục 15).
export async function approve(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')

    const appointment = await LichHen.findById(id)
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    if (appointment.de_xuat_doi?.trang_thai !== 'cho_admin_duyet') {
      return fail(res, 409, 'De xuat nay khong o trang thai cho duyet')
    }
    if ((appointment.de_xuat_doi.phuong_an?.length ?? 0) === 0) {
      return fail(res, 409, 'De xuat khong co phuong an nao de duyet — phai lien he khach truc tiep')
    }

    appointment.de_xuat_doi.trang_thai = 'cho_khach_chon'
    appointment.de_xuat_doi.nguoi_duyet_id = req.user.id
    appointment.de_xuat_doi.thoi_diem_duyet = new Date()
    // Cap lai han phan hoi tu luc nay — khach khong bi tru vao thoi gian admin da giu don
    // (han cu la han cua trang thai cho_admin_duyet, dai hon va khong con y nghia).
    appointment.de_xuat_doi.han_phan_hoi = new Date(Date.now() + GIO_HAN_PHAN_HOI * 3600_000)
    if (req.body.ghi_chu) appointment.de_xuat_doi.ghi_chu = String(req.body.ghi_chu).slice(0, 500)
    await appointment.save()

    await guiThongBaoDeXuat(appointment)

    return ok(res, fmt(appointment.toObject()), 'Da duyet phuong an va gui cho khach chon')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reschedule-approvals/:id/reject ───────────────────────
// Bác bỏ phương án tự sinh (vd admin đã gọi điện thoả thuận riêng với khách).
// Nhả hết chỗ đã giữ để không treo ghế trống, và ghi lại lý do.
export async function reject(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')
    const { ly_do } = req.body
    if (!ly_do?.trim()) return fail(res, 400, 'Phai ghi ly do khong duyet')

    const appointment = await LichHen.findById(id)
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    if (appointment.de_xuat_doi?.trang_thai !== 'cho_admin_duyet') {
      return fail(res, 409, 'De xuat nay khong o trang thai cho duyet')
    }

    for (const pa of appointment.de_xuat_doi.phuong_an ?? []) await nhaChoDaGiu(pa)

    appointment.de_xuat_doi.trang_thai = 'da_huy'
    appointment.de_xuat_doi.nguoi_duyet_id = req.user.id
    appointment.de_xuat_doi.thoi_diem_duyet = new Date()
    appointment.de_xuat_doi.ghi_chu = ly_do.trim().slice(0, 500)
    await appointment.save()

    return ok(
      res,
      fmt(appointment.toObject()),
      'Da bo phuong an tu sinh. Lich hen van con hieu luc va khach VAN GIU quyen doi — phai lien he khach de xep tay.',
    )
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/reschedule-approvals/:id/free-slots?doctor_id=&date= ────
// Danh sách slot còn trống của MỘT bác sĩ trong MỘT ngày, cùng chuyên khoa với lịch hẹn
// gốc — dùng cho panel "Chọn khác" (chọn tay tự do, mục 15). KHÔNG áp ràng buộc "hôm nay +
// khung hiện tại/kế tiếp" của mục 13 — đó là ràng buộc riêng cho luồng đặt walk-in tại
// quầy, không áp dụng cho điều phối lại lịch đã có của phòng khám.
export async function freeSlots(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')
    const { doctor_id: doctorId, date } = req.query
    if (!doctorId || !date) return fail(res, 400, 'Thieu doctor_id/date')

    const appointment = await LichHen.findById(id).select('specialty_id').lean()
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    const specialtyId = String(appointment.specialty_id ?? '')

    const ngayBatDau = new Date(date)
    if (Number.isNaN(ngayBatDau.getTime())) return fail(res, 400, 'date khong hop le')
    const ngayKetThuc = new Date(ngayBatDau.getTime() + 86400000)

    const schedule = await LichLamViec.findOne({
      doctor_id: doctorId,
      ngay: { $gte: ngayBatDau, $lt: ngayKetThuc },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()
    if (!schedule) return ok(res, { schedule_id: null, slots: [] })

    const now = new Date()
    const slots = schedule.slots
      .filter((slot) => slotConTrong(slot))
      .filter((slot) => !specialtyId || !slot.specialty_id || String(slot.specialty_id) === specialtyId)
      .filter((slot) => !isSlotInPast(schedule.ngay, slot.gio_bat_dau, now))
      .filter((slot) => !quaSatGioBatDau(schedule.ngay, slot.gio_bat_dau, now))
      .map((slot) => ({
        slot_id: slot._id,
        gio_bat_dau: slot.gio_bat_dau,
        gio_ket_thuc: slot.gio_ket_thuc,
        loai_slot: slot.loai_slot,
      }))

    return ok(res, { schedule_id: schedule._id, slots })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reschedule-approvals/:id/chon-tay ─────────────────────
// Chọn tay TỰ DO một bác sĩ/ngày/slot ngoài danh sách gợi ý (mục 15, chốt 2026-08-22) —
// dùng khi khách có yêu cầu riêng. Chỉ áp dụng cho lịch hẹn đang có `de_xuat_doi` mở.
export async function chonTay(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')

    const { doctor_id: doctorId, schedule_id: scheduleId, slot_id: slotId } = req.body
    if (!doctorId || !scheduleId || !slotId) {
      return fail(res, 400, 'Thieu doctor_id/schedule_id/slot_id')
    }

    const appointment = await LichHen.findById(id)
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')

    await chonPhuongAnTuDo({
      appointment,
      doctorId,
      scheduleId,
      slotId,
      actorUserId: req.user.id,
      actorRole: req.user.role,
    })

    return ok(res, fmt(appointment.toObject()), 'Da doi lich sang slot da chon.')
  } catch (err) {
    return fail(res, err.statusCode ?? 500, err.message)
  }
}
