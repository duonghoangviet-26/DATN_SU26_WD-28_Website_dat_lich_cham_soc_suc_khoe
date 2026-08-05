import mongoose from 'mongoose'
import { HangDoi, LichHen, LichSuLichHen, NhatKyThaoTac } from '../models/index.js'
import { emitDashboardAppointmentChanged } from '../realtime/socket.js'
import { traSlotVePool } from './offlineIntake.service.js'

// ============================================================
// E-11 — Đóng lượt hàng đợi khi khách bỏ về, dùng CHUNG cho bác sĩ và lễ tân.
// Trước đây chỉ bác sĩ đóng được (`doctor/queue.controller.js:cancel`); lễ tân không có
// đường gọi dù cùng đứng ở quầy chứng kiến khách bỏ về. Tách ra đây để hai vai trò không
// lặp lại logic (rule "check-in đi qua duy nhất 1 service" — mục 7 — áp dụng tương tự ở đây
// để tránh lặp lại lớp bug đã xảy ra khi luồng check-in từng bị tách đôi).
//
// ⚠️ KHÔNG được đặt `LichHen.status='no_show'` ở đây — khách đã bước chân tới quầy (có
// `HangDoi`) thì rule mục 8 cấm tuyệt đối gán no_show, dù trạng thái sau đó là gì. Đặt
// `status='cancelled'`, và `services/noShowSweep.service.js` loại trừ theo SỰ TỒN TẠI của
// bản ghi HangDoi (không lọc theo trạng thái đang hoạt động) nên lượt đã đóng vẫn miễn nhiễm.
// ============================================================

const CON_HIEN_DIEN = ['dang_cho', 'da_goi']

function throwErr(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode })
}

/** Lễ tân bắt buộc phải nhập lý do; bác sĩ giữ hành vi cũ (không bắt buộc). */
export function chuanHoaLyDoHuyLuot(lyDo, batBuocLyDo) {
  const reason = String(lyDo ?? '').trim()
  if (batBuocLyDo && !reason) throwErr(400, 'Cần nhập lý do khi đóng lượt')
  return reason || null
}

export async function huyLuotHangDoi({ entryId, lyDo = null, actorUserId, actorRole, restrictToDoctorId = null }) {
  if (!mongoose.Types.ObjectId.isValid(entryId)) throwErr(400, 'Mã lượt chờ không hợp lệ')
  const reason = chuanHoaLyDoHuyLuot(lyDo, actorRole === 'receptionist')

  const entry = await HangDoi.findById(entryId).lean()
  if (!entry) throwErr(404, 'Không tìm thấy hàng đợi')
  if (restrictToDoctorId && String(entry.doctor_id) !== String(restrictToDoctorId)) {
    throwErr(403, 'Hàng đợi này không thuộc lịch của bạn')
  }
  if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
    throwErr(409, entry.trang_thai === 'trong_phong'
      ? 'Bệnh nhân đang trong phòng khám, không thể đóng lượt'
      : `Lượt này đang ở trạng thái "${entry.trang_thai}", không thể đóng`)
  }

  const trangThaiCu = entry.trang_thai
  let appointmentBeforeStatus = null
  let appointmentAfter = null

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      // Lọc kèm trạng thái CŨ — chặn hai người cùng đóng một lượt đồng thời.
      const updated = await HangDoi.findOneAndUpdate(
        { _id: entryId, trang_thai: trangThaiCu },
        { $set: { trang_thai: 'cancelled' } },
        { new: true, session },
      )
      if (!updated) throwErr(409, 'Lượt chờ vừa được người khác xử lý, vui lòng tải lại hàng đợi')

      if (entry.appointment_id) {
        const appointment = await LichHen.findById(entry.appointment_id).session(session)
        if (appointment) {
          appointmentBeforeStatus = appointment.status
          await LichSuLichHen.create([{
            appointment_id: appointment._id,
            tu_trang_thai: appointment.status,
            den_trang_thai: 'cancelled',
            loai_thay_doi: 'queue_cancel',
            ly_do_thay_doi: reason,
            nguoi_thuc_hien_id: actorUserId,
            vai_tro: actorRole,
            kenh_thay_doi: actorRole,
          }], { session })
          appointment.status = 'cancelled'
          await appointment.save({ session })
          appointmentAfter = appointment.toObject()
        }
      }

      await NhatKyThaoTac.create([{
        nguoi_thuc_hien_id: actorUserId,
        vai_tro: actorRole,
        hanh_dong: 'HUY_LUOT_HANG_DOI',
        loai_doi_tuong: 'queue_entry',
        doi_tuong_id: entryId,
        ly_do: reason,
        du_lieu_cu: { trang_thai: trangThaiCu },
        du_lieu_moi: { trang_thai: 'cancelled' },
      }], { session })
    })
  } finally {
    await session.endSession()
  }

  // Realtime + trả slot walk-in về pool SAU khi commit — không trước (rule chống đọc
  // dữ liệu chưa commit). `traSlotVePool` không hỗ trợ session nên tách ra ngoài transaction;
  // đây là hiệu ứng phụ về sức chứa, không phải phần bắt buộc phải nguyên tử với việc đóng lượt.
  if (appointmentAfter) {
    emitDashboardAppointmentChanged(appointmentBeforeStatus, 'cancelled')
  } else {
    await traSlotVePool(entry)
  }

  return { entry: { _id: String(entryId), trang_thai: 'cancelled' }, appointment: appointmentAfter }
}
