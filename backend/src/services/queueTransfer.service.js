import mongoose from 'mongoose'
import { HangDoi, BacSi, LichHen, LichSuLichHen, NhatKyThaoTac } from '../models/index.js'
import {
  bacSiDangTrongCaLamViec,
  khungHienTaiBiKhoaNghiPhep,
  phongKhamHienTaiCuaBacSi,
} from './doctorAvailability.service.js'
import { notifyAppointmentCustomerChange } from './appointmentCustomerNotification.service.js'
import { notifyDoctorQueueUpdated } from './doctorQueueRealtime.service.js'

// ============================================================
// E-4 — Chuyển lượt ĐANG CHỜ sang bác sĩ khác (rule mục 6, khác việc dời LichHen —
// xem bảng phân biệt trong Ke hoach task chi tiet FE-BE-DB...md). Đối tượng là khách
// ĐÃ NGỒI CHỜ, không đụng LichLamViec/slot; chỉ đổi doctor_id + phong_kham của lượt.
// ============================================================

function throwErr(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode })
}

export function validateTransferReason(lyDo) {
  const reason = String(lyDo ?? '').trim()
  if (!reason) throwErr(400, 'Cần nhập lý do khi chuyển bác sĩ')
  return reason
}

// `BacSi.specialties` là mảng (bác sĩ có thể nhiều chuyên khoa); `HangDoi.specialty_id`
// là một chuyên khoa duy nhất của lượt chờ đó. Tách riêng để unit test không cần Mongo.
export function doctorCoChuyenKhoa(doctorSpecialties, specialtyId) {
  return (doctorSpecialties ?? []).some((id) => String(id) === String(specialtyId))
}

export async function transferQueueEntry({ entryId, doctorIdMoi, lyDo, actorUserId, now = new Date() }) {
  const reason = validateTransferReason(lyDo)
  if (!mongoose.Types.ObjectId.isValid(entryId)) throwErr(400, 'Mã lượt chờ không hợp lệ')
  if (!doctorIdMoi || !mongoose.Types.ObjectId.isValid(doctorIdMoi)) throwErr(400, 'Cần chọn bác sĩ đích hợp lệ')

  const entry = await HangDoi.findById(entryId).lean()
  if (!entry) throwErr(404, 'Không tìm thấy lượt chờ')
  if (String(entry.doctor_id) === String(doctorIdMoi)) throwErr(400, 'Bác sĩ đích phải khác bác sĩ hiện tại')
  // Chỉ chuyển được lượt ĐANG CHỜ — đã gọi/vào phòng/xong/huỷ thì không còn ý nghĩa để chuyển.
  if (entry.trang_thai !== 'dang_cho') {
    throwErr(409, `Lượt này đang ở trạng thái "${entry.trang_thai}", không thể chuyển bác sĩ`)
  }

  const targetDoctor = await BacSi.findOne({
    _id: doctorIdMoi,
    trang_thai_duyet: 'approved',
    la_hien: true,
  }).select('_id user_id specialties phong_kham_mac_dinh').lean()
  if (!targetDoctor) throwErr(404, 'Không tìm thấy bác sĩ đích đang hoạt động')

  if (!doctorCoChuyenKhoa(targetDoctor.specialties, entry.specialty_id)) {
    throwErr(409, 'Bác sĩ đích không cùng chuyên khoa với lượt chờ này')
  }

  if (!(await bacSiDangTrongCaLamViec(doctorIdMoi, now))) {
    throwErr(409, 'Bác sĩ đích hiện không trong ca làm việc (không có lịch hôm nay ở khung giờ hiện tại)')
  }
  if (await khungHienTaiBiKhoaNghiPhep(doctorIdMoi, now)) {
    throwErr(409, 'Bác sĩ đích đang nghỉ phép ở khung giờ hiện tại')
  }

  const phongKhamMoi = (await phongKhamHienTaiCuaBacSi(doctorIdMoi, now)) ?? targetDoctor.phong_kham_mac_dinh ?? null

  const doctorIdCu = entry.doctor_id
  const phongKhamCu = entry.phong_kham

  let updatedEntry = null
  let appointmentAfter = null
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      // Điều kiện lọc kèm doctor_id CŨ — nếu 2 lễ tân chuyển đồng thời, người thứ hai sẽ
      // không khớp filter (doctor_id đã đổi) và findOneAndUpdate trả null -> 409.
      updatedEntry = await HangDoi.findOneAndUpdate(
        { _id: entryId, trang_thai: 'dang_cho', doctor_id: doctorIdCu },
        // Giữ nguyên ma_so_thu_tu, so_thu_tu_checkin, checkin_time — chỉ đổi bác sĩ + phòng.
        { $set: { doctor_id: doctorIdMoi, phong_kham: phongKhamMoi } },
        { new: true, session },
      )
      if (!updatedEntry) {
        throwErr(409, 'Lượt chờ vừa được người khác xử lý, vui lòng tải lại hàng đợi')
      }

      if (entry.appointment_id) {
        const appointmentBefore = await LichHen.findById(entry.appointment_id).session(session)
        if (appointmentBefore) {
          const specialtyId = appointmentBefore.specialty_id ?? entry.specialty_id
          await LichSuLichHen.create([{
            appointment_id: appointmentBefore._id,
            tu_trang_thai: appointmentBefore.status,
            den_trang_thai: appointmentBefore.status,
            loai_thay_doi: 'queue_transfer',
            ly_do_thay_doi: reason,
            bac_si_cu_id: doctorIdCu,
            bac_si_moi_id: doctorIdMoi,
            specialty_cu_id: specialtyId,
            specialty_moi_id: specialtyId,
          }], { session })

          appointmentBefore.doctor_id = doctorIdMoi
          await appointmentBefore.save({ session })
          appointmentAfter = appointmentBefore.toObject()
        }
      }

      await NhatKyThaoTac.create([{
        nguoi_thuc_hien_id: actorUserId,
        vai_tro: 'receptionist',
        hanh_dong: 'CHUYEN_HANG_DOI',
        loai_doi_tuong: 'queue_entry',
        doi_tuong_id: entryId,
        ly_do: reason,
        du_lieu_cu: { doctor_id: doctorIdCu, phong_kham: phongKhamCu },
        du_lieu_moi: { doctor_id: doctorIdMoi, phong_kham: phongKhamMoi },
      }], { session })
    })
  } finally {
    await session.endSession()
  }

  // Thông báo + realtime SAU khi commit — tránh dashboard đọc dữ liệu chưa commit,
  // và tránh emit lặp nếu transaction phải retry (rule "Emit realtime sau commit").
  if (appointmentAfter) {
    await notifyAppointmentCustomerChange({
      appointment: appointmentAfter,
      action: 'doctor_changed',
      reason,
      actorUserId,
      actorRole: 'receptionist',
    })
  }
  await notifyDoctorQueueUpdated(doctorIdCu, { reason: 'queue_transfer_out', entry_id: entryId })
  await notifyDoctorQueueUpdated(doctorIdMoi, { reason: 'queue_transfer_in', entry_id: entryId })

  return { entry: updatedEntry, doctor_id_cu: doctorIdCu, doctor_id_moi: doctorIdMoi, phong_kham_moi: phongKhamMoi }
}
