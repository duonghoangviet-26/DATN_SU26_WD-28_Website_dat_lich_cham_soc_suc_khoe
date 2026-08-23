import { NghiPhepBacSi, LichLamViec, LichHen, HangDoi } from '../models/index.js'
import { AFFECTED_BY_LEAVE_STATUSES } from '../utils/appointmentStatus.js'
import { taoDeXuatDoiChoDonNghi } from './appointmentReschedule.service.js'
import { nenKhoaSlotVaoDonNghi, laSlotGiuChoDeXuat, nenSinhLaiDeXuat } from './rescheduleRules.js'

// ============================================================
// Duyệt đơn nghỉ phép — DÙNG CHUNG cho Admin (mọi kỳ hạn) và Lễ tân (kỳ ngắn).
// Rút ra từ admin/doctor-leaves.controller.js để tránh 2 nơi cài đặt khác nhau
// cùng một hành vi khoá slot + sinh đề xuất — đúng nguyên tắc mục 7 ("check-in
// đi qua duy nhất 1 service"). Thiết kế: docs/superpowers/specs/2026-08-03-luong-bac-si-nghi-design.md
// ============================================================

/**
 * Đơn nghỉ mà LỄ TÂN được phép duyệt: kết thúc chậm nhất ngày mai, kéo dài tối đa 1 ngày.
 *
 * Bắt buộc có cận dưới `denNgay >= homNay` — thiếu điều kiện này thì đơn đã hết hạn từ lâu
 * (vd tạo cách đây nhiều tuần, chưa ai xử lý — dữ liệu rác test, không phải tình huống thật)
 * vẫn lọt qua vì `denNgay <= ngayMai` luôn đúng với mọi ngày trong quá khứ. Phát hiện khi demo
 * 2026-08-03: 4 đơn test cũ dán nhãn "cần lễ tân duyệt gấp" dù đã qua ngày từ lâu.
 */
export function laDonNganHanChoLeTan(leave) {
  const homNay = new Date()
  homNay.setUTCHours(0, 0, 0, 0)
  const ngayMai = new Date(homNay.getTime() + 86400000)

  const denNgay = new Date(leave.den_ngay)
  const tuNgay = new Date(leave.tu_ngay)
  const soNgay = Math.round((denNgay - tuNgay) / 86400000)

  return denNgay >= homNay && denNgay <= ngayMai && soNgay <= 1
}

// Khóa các slot 'active' VÀ 'pending_payment' của bác sĩ trong khoảng ngày nghỉ đã duyệt —
// dùng field bi_khoa_boi_nghi_phep/nghi_phep_id đã có sẵn trong schema (KHÔNG đổi model).
// Slot đã booked KHÔNG bị đụng — Admin/lễ tân tự xử lý thủ công (không tự hủy lịch BN).
//
// G3 (2026-08-03): slot 'pending_payment' TRƯỚC ĐÂY bị bỏ qua — khách đang giữ chỗ chờ trả
// tiền cho một bác sĩ vừa báo nghỉ vẫn thanh toán được, biến thành 'booked' cho bác sĩ đã
// nghỉ. Nay khoá cả 'pending_payment'; `markPaymentPaid` sẽ tự phát hiện slot bị khoá và
// đẩy khách vào luồng đề xuất dời thay vì chốt booking (xem patient/payments.controller.js).
//
// 2026-08-23 (P0-3): khoa ca slot dang GIU SAN cho de xuat doi cua lich hen khac. Truoc day
// bo loc chi co ['active','pending_payment'] nen slot do (da o 'locked') bi bo qua hoan toan.
async function lockSlotsForLeave(leave, session) {
  const endExclusive = new Date(leave.den_ngay)
  endExclusive.setDate(endExclusive.getDate() + 1)

  const schedules = await LichLamViec.find({
    doctor_id: leave.bac_si_id,
    ngay: { $gte: leave.tu_ngay, $lt: endExclusive },
  }).session(session)

  let slotsLocked = 0
  // Slot vốn đang GIỮ SẴN cho đề xuất dời của một lịch hẹn khác, nay bị đơn nghỉ này vô
  // hiệu — những lịch hẹn đó phải được sinh lại phương án, nếu không cron quá hạn sẽ đẩy
  // khách vào đúng slot của bác sĩ vừa nghỉ (P0-3).
  const slotGiuChoBiHuy = []

  for (const schedule of schedules) {
    let changed = false

    for (const slot of schedule.slots) {
      const inRange = !leave.gio_bat_dau || !leave.gio_ket_thuc
        ? true
        : slot.gio_bat_dau < leave.gio_ket_thuc && slot.gio_ket_thuc > leave.gio_bat_dau
      if (!inRange || !nenKhoaSlotVaoDonNghi(slot)) continue

      if (laSlotGiuChoDeXuat(slot)) slotGiuChoBiHuy.push(slot._id)

      slot.status = 'locked'
      slot.bi_khoa_boi_nghi_phep = true
      slot.nghi_phep_id = leave._id
      slot.benh_nhan_tam_giu_id = null
      slotsLocked += 1
      changed = true
    }

    if (!leave.gio_bat_dau && schedule.trang_thai_ngay === 'lam_viec') {
      schedule.trang_thai_ngay = 'nghi_phep'
      changed = true
    }

    if (changed) await schedule.save({ session })
  }

  return { slotsLocked, slotGiuChoBiHuy }
}

// Lịch hẹn CÒN HIỆU LỰC trong khoảng nghỉ (+ khung giờ nếu có) — trả cho người duyệt biết cần
// liên hệ bệnh nhân xử lý. CHỈ ĐỌC, không tự hủy/sửa lịch hẹn ở đây.
//
// Chọn đủ field để phân loại được khách ĐÃ CHECK-IN (cần chuyển bác sĩ tại quầy, không đề
// xuất dời) khỏi khách CHƯA ĐẾN (đề xuất dời tự động) — xem duyetDonNghi bên dưới.
async function findAffectedAppointments(leave, session) {
  const endExclusive = new Date(leave.den_ngay)
  endExclusive.setDate(endExclusive.getDate() + 1)

  let appointments = await LichHen.find({
    doctor_id: leave.bac_si_id,
    status: { $in: AFFECTED_BY_LEAVE_STATUSES },
    ngay_kham: { $gte: leave.tu_ngay, $lt: endExclusive },
  })
    .select('ma_lich_hen ngay_kham gio_kham status ten_khach so_dien_thoai_khach user_id doctor_id specialty_id payment_status de_xuat_doi')
    .session(session)
    .lean()

  if (leave.gio_bat_dau && leave.gio_ket_thuc) {
    appointments = appointments.filter((a) => a.gio_kham >= leave.gio_bat_dau && a.gio_kham < leave.gio_ket_thuc)
  }
  return appointments
}

/**
 * Duyệt một đơn nghỉ: khoá slot, tìm lịch bị ảnh hưởng, sinh đề xuất dời.
 * Gọi trong transaction đã mở sẵn (session bắt buộc — thao tác nhiều collection).
 *
 * Khách ĐÃ CHECK-IN (có bản ghi HangDoi đang chờ/đã gọi/trong phòng) KHÔNG được tạo đề xuất
 * dời — họ đã có mặt tại phòng khám, việc cần làm là chuyển sang bác sĩ khác NGAY TẠI QUẦY,
 * không phải hẹn lại ngày khác. Trả riêng nhóm này ở `canDieuPhoiTaiQuay` để FE hiện đúng
 * hành động (rút từ `reportDoctorUnavailable`, hợp nhất về một chỗ theo nguyên tắc mục 7).
 */
export async function duyetDonNghi({ leave, actorUserId, ghiChu, session }) {
  if (leave.trang_thai !== 'cho_duyet') {
    throw Object.assign(new Error('Chi duyet duoc don dang cho duyet'), { statusCode: 409 })
  }

  leave.trang_thai = 'da_duyet'
  leave.nguoi_duyet_id = actorUserId
  leave.thoi_diem_duyet = new Date()
  if (ghiChu !== undefined) leave.ghi_chu = ghiChu
  await leave.save({ session })

  const { slotsLocked, slotGiuChoBiHuy } = await lockSlotsForLeave(leave, session)
  const affectedAppointments = await findAffectedAppointments(leave, session)

  const queueEntries = affectedAppointments.length
    ? await HangDoi.find({
        appointment_id: { $in: affectedAppointments.map((a) => a._id) },
        trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
      }).select('appointment_id trang_thai ma_so_thu_tu ten_benh_nhan doctor_id').session(session).lean()
    : []
  const queueByAppointment = new Map(queueEntries.map((entry) => [String(entry.appointment_id), entry]))

  const appointmentsForProposal = affectedAppointments.filter((a) => (
    ['pending', 'confirmed'].includes(a.status)
    && !a.de_xuat_doi
    && !queueByAppointment.has(String(a._id))
  ))

  const canDieuPhoiTaiQuay = affectedAppointments
    .filter((a) => !appointmentsForProposal.some((eligible) => String(eligible._id) === String(a._id)))
    .map((a) => {
      const queue = queueByAppointment.get(String(a._id))
      return {
        appointment_id: a._id,
        ma_lich_hen: a.ma_lich_hen ?? null,
        status: a.status,
        ten_khach: a.ten_khach ?? null,
        gio_kham: a.gio_kham,
        doctor_id: a.doctor_id ?? null,
        specialty_id: a.specialty_id ?? null,
        ly_do_bo_qua: queue?.trang_thai === 'trong_phong'
          ? 'benh_nhan_dang_trong_phong'
          : queue
            ? 'da_checkin_can_dieu_phoi_tai_quay'
            : a.de_xuat_doi
              ? 'dang_co_de_xuat_doi_mo'
              : 'trang_thai_khong_cho_phep_tao_de_xuat',
        hang_doi: queue
          ? { hang_doi_id: queue._id, trang_thai: queue.trang_thai, ma_so_thu_tu: queue.ma_so_thu_tu ?? null }
          : null,
      }
    })

  // Rule mục 14/15: KHÔNG HOÀN TIỀN, nên phòng khám phải tự tìm chỗ thay cho khách —
  // hệ thống sinh phương án và giữ sẵn chỗ ngay tại đây. Chỉ cho nhóm CHƯA đến quầy.
  const deXuat = appointmentsForProposal.length > 0
    ? await taoDeXuatDoiChoDonNghi(leave, { session, appointmentIds: appointmentsForProposal.map((a) => a._id) })
    : []

  return { slotsLocked, affectedAppointments, canDieuPhoiTaiQuay, deXuat }
}

/** Từ chối một đơn nghỉ — chỉ đổi trạng thái, không đụng slot/lịch hẹn. */
export async function tuChoiDonNghi({ leave, actorUserId, ghiChu, session }) {
  if (leave.trang_thai !== 'cho_duyet') {
    throw Object.assign(new Error('Chi tu choi duoc don dang cho duyet'), { statusCode: 409 })
  }

  leave.trang_thai = 'tu_choi'
  leave.nguoi_duyet_id = actorUserId
  leave.thoi_diem_duyet = new Date()
  if (ghiChu) leave.ghi_chu = ghiChu
  await leave.save(session ? { session } : {})

  return leave
}

export function findLeaveByIdWithDoctor(id) {
  return NghiPhepBacSi.findById(id)
    .populate({
      path: 'bac_si_id',
      select: 'user_id trang_thai',
      populate: { path: 'user_id', select: 'ho_ten' },
    })
}

// Nói rõ người duyệt còn phải làm gì, thay vì chỉ báo "duyệt thành công".
export function moTaKetQuaDuyet(soLichAnhHuong, deXuat) {
  if (soLichAnhHuong === 0) return 'Duyệt đơn nghỉ phép thành công'

  const phan = [`Duyệt đơn nghỉ phép thành công. ${soLichAnhHuong} lịch hẹn bị ảnh hưởng.`]
  const choDuyet = deXuat.filter((d) => d.cho_admin_duyet).length
  const khongCo = deXuat.filter((d) => d.so_phuong_an === 0).length

  if (choDuyet > 0) phan.push(`${choDuyet} lịch ĐÃ THANH TOÁN — đã báo khách, đang chờ Admin duyệt phương án cuối.`)
  if (khongCo > 0) phan.push(`${khongCo} lịch KHÔNG tìm được phương án trong ngày — phải liên hệ khách.`)
  const daBaoKhach = deXuat.length - choDuyet - khongCo
  if (daBaoKhach > 0) phan.push(`${daBaoKhach} lịch đã gửi phương án cho khách chọn.`)

  return phan.join(' ')
}
