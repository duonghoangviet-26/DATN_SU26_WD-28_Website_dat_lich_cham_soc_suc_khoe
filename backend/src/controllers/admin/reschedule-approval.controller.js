import mongoose from 'mongoose'

import { LichHen, LichLamViec, NghiPhepBacSi, HangDoi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { isSlotInPast, quaSatGioBatDau } from '../../utils/clinicTime.js'
import { TRANG_THAI_DE_XUAT_MO } from '../../services/rescheduleRules.js'
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
    // Bảng điều phối cần lọc bác sĩ cùng chuyên khoa và biết khách còn quyền dời không.
    specialty_id: appointment.specialty_id ?? null,
    nguon: appointment.nguon ?? null,
    so_lan_doi_khach_yeu_cau: appointment.so_lan_doi_khach_yeu_cau ?? 0,
    gia_kham: appointment.gia_kham,
    payment_status: appointment.payment_status,
    de_xuat: {
      nghi_phep_id: dx?.nghi_phep_id ?? null,
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
        // 3 id dưới đây để UI bấm "dời theo phương án #n" đi thẳng đường `chon-tay` —
        // cùng ràng buộc slot, chỉ khác điểm vào.
        doctor_id: pa.doctor_id ?? null,
        schedule_id: pa.schedule_id ?? null,
        slot_id: pa.slot_id ?? null,
        da_giu_cho: Boolean(pa.da_giu_cho),
        // Lấn slot khách-tới-quầy là ngoại lệ duy nhất của mục 15 — người duyệt phải thấy rõ
        // mình đang duyệt cái gì.
        lan_walk_in: Boolean(pa.lan_walk_in),
      })),
    },
  }
}

// ─── GET /api/{admin|receptionist}/reschedule-approvals ─────────────────────
// ?leave_id= lọc theo đơn nghỉ (trang điều phối của MỘT bác sĩ nghỉ)
// ?trang_thai= lọc theo trạng thái, mặc định lấy CẢ HAI trạng thái còn mở — bảng điều phối
//   phải nhìn được toàn cục, không chỉ nhóm đang chờ duyệt.
export async function list(req, res) {
  try {
    const { leave_id: leaveId, trang_thai: trangThai } = req.query

    const loc = {}
    if (trangThai) {
      const danhSachTrangThai = String(trangThai).split(',').map((s) => s.trim()).filter(Boolean)
      loc['de_xuat_doi.trang_thai'] = { $in: danhSachTrangThai }
    } else {
      loc['de_xuat_doi.trang_thai'] = { $in: TRANG_THAI_DE_XUAT_MO }
    }
    if (leaveId) {
      if (!mongoose.Types.ObjectId.isValid(leaveId)) return fail(res, 400, 'leave_id khong hop le')
      loc['de_xuat_doi.nghi_phep_id'] = new mongoose.Types.ObjectId(leaveId)
    }

    const danhSach = await LichHen.find(loc)
      .sort({ ngay_kham: 1, gio_kham: 1 })
      .lean()

    return ok(res, danhSach.map(fmt))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET .../reschedule-approvals/leave/:leaveId/tong-quan ──────────────────
// Header của trang điều phối: một dòng nói rõ còn bao nhiêu việc, thuộc loại nào.
export async function tongQuanTheoDonNghi(req, res) {
  try {
    const { leaveId } = req.params
    if (!mongoose.Types.ObjectId.isValid(leaveId)) return fail(res, 400, 'leaveId khong hop le')

    const leave = await NghiPhepBacSi.findById(leaveId)
      .populate({ path: 'bac_si_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .lean()
    if (!leave) return fail(res, 404, 'Khong tim thay don nghi')

    const danhSach = await LichHen.find({ 'de_xuat_doi.nghi_phep_id': leave._id })
      .select('_id de_xuat_doi status')
      .lean()

    const dem = (dieuKien) => danhSach.filter(dieuKien).length

    // Khách ĐÃ CHECK-IN không nằm trong luồng `de_xuat_doi` — họ đang ngồi ở quầy, việc cần
    // làm là chuyển bác sĩ NGAY, không phải hẹn lại ngày khác. Trả về để bảng điều phối hiện
    // họ thành hàng riêng, không tick checkbox được (C3).
    const hangDoi = await HangDoi.find({
      doctor_id: leave.bac_si_id,
      trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
    }).select('_id appointment_id trang_thai ma_so_thu_tu ten_benh_nhan').lean()

    const lichTaiQuay = hangDoi.length
      ? await LichHen.find({ _id: { $in: hangDoi.map((h) => h.appointment_id).filter(Boolean) } })
          .select('_id ma_lich_hen ten_khach so_dien_thoai_khach gio_kham doctor_id specialty_id')
          .lean()
      : []
    const lichTheoId = new Map(lichTaiQuay.map((a) => [String(a._id), a]))

    const taiQuay = hangDoi.map((h) => {
      const lich = lichTheoId.get(String(h.appointment_id))
      return {
        hang_doi_id: h._id,
        appointment_id: h.appointment_id ?? null,
        trang_thai_hang_doi: h.trang_thai,
        ma_so_thu_tu: h.ma_so_thu_tu ?? null,
        ten_khach: lich?.ten_khach ?? h.ten_benh_nhan ?? null,
        so_dien_thoai_khach: lich?.so_dien_thoai_khach ?? null,
        gio_kham: lich?.gio_kham ?? null,
        ma_lich_hen: lich?.ma_lich_hen ?? null,
        doctor_id: lich?.doctor_id ?? leave.bac_si_id,
        specialty_id: lich?.specialty_id ?? null,
      }
    })

    return ok(res, {
      leave_id: leave._id,
      bac_si: leave.bac_si_id?.user_id?.ho_ten ?? 'Bác sĩ',
      bac_si_id: leave.bac_si_id?._id ?? leave.bac_si_id ?? null,
      trang_thai_don: leave.trang_thai,
      khoang_nghi: {
        tu_ngay: leave.tu_ngay,
        den_ngay: leave.den_ngay,
        gio_bat_dau: leave.gio_bat_dau ?? null,
        gio_ket_thuc: leave.gio_ket_thuc ?? null,
      },
      ly_do: leave.ly_do ?? null,
      so_lich_anh_huong: danhSach.length,
      so_cho_duyet: dem((a) => a.de_xuat_doi?.trang_thai === 'cho_admin_duyet'),
      so_cho_khach_chon: dem((a) => a.de_xuat_doi?.trang_thai === 'cho_khach_chon'),
      so_da_doi: dem((a) => a.de_xuat_doi?.trang_thai === 'da_ap_dung'),
      so_khong_co_cho: dem((a) => (a.de_xuat_doi?.phuong_an?.length ?? 0) === 0
        && TRANG_THAI_DE_XUAT_MO.includes(a.de_xuat_doi?.trang_thai)),
      so_tai_quay: taiQuay.length,
      tai_quay: taiQuay,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET .../reschedule-approvals/leaves ────────────────────────────────────
// Danh sách đơn nghỉ CÒN việc chưa xử lý — trang đầu của mục "Điều phối lịch hẹn".
export async function danhSachDonNghiConViec(req, res) {
  try {
    const nhomTheoDon = await LichHen.aggregate([
      { $match: { 'de_xuat_doi.trang_thai': { $in: TRANG_THAI_DE_XUAT_MO } } },
      { $group: { _id: '$de_xuat_doi.nghi_phep_id', so_lich: { $sum: 1 } } },
    ])
    const ids = nhomTheoDon.map((n) => n._id).filter(Boolean)
    if (ids.length === 0) return ok(res, [])

    const leaves = await NghiPhepBacSi.find({ _id: { $in: ids } })
      .populate({ path: 'bac_si_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .sort({ tu_ngay: -1 })
      .lean()

    const soLichTheoDon = new Map(nhomTheoDon.map((n) => [String(n._id), n.so_lich]))
    return ok(res, leaves.map((leave) => ({
      leave_id: leave._id,
      bac_si: leave.bac_si_id?.user_id?.ho_ten ?? 'Bác sĩ',
      tu_ngay: leave.tu_ngay,
      den_ngay: leave.den_ngay,
      gio_bat_dau: leave.gio_bat_dau ?? null,
      gio_ket_thuc: leave.gio_ket_thuc ?? null,
      ly_do: leave.ly_do ?? null,
      trang_thai_don: leave.trang_thai,
      so_lich_chua_xu_ly: soLichTheoDon.get(String(leave._id)) ?? 0,
    })))
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
