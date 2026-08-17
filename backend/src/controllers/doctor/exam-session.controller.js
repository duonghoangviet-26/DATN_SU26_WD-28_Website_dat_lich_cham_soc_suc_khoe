import { BacSi, HangDoi, NguoiDung, ThongBao } from '../../models/index.js'
import {
  dinhChinhHoSo,
  hoanTatPhienKham,
  layPhienKham,
  luuBuoc,
} from '../../services/examSession.service.js'
import { ok, fail } from '../../utils/response.js'

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

// GET /api/doctor/exam-session/:queueId
export async function get(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    return ok(res, await layPhienKham({ queueId: req.params.queueId, docId }))
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}

// PATCH /api/doctor/exam-session/:queueId/step/:buoc
export async function saveStep(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const phien = await luuBuoc({
      queueId: req.params.queueId,
      docId,
      doctorUserId: req.user.id,
      buoc: req.params.buoc,
      payload: req.body ?? {},
    })
    return ok(res, phien, 'Đã lưu')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message, err.data ?? null)
  }
}

// POST /api/doctor/exam-session/:queueId/complete
export async function complete(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const ketQua = await hoanTatPhienKham({
      queueId: req.params.queueId,
      docId,
      doctorUserId: req.user.id,
    })
    return ok(res, ketQua, 'Đã hoàn tất ca khám')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}

// PATCH /api/doctor/exam-session/:queueId/amendment
export async function amend(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const phien = await dinhChinhHoSo({
      queueId: req.params.queueId,
      docId,
      doctorUserId: req.user.id,
      thayDoi: req.body?.thay_doi ?? {},
      lyDo: req.body?.ly_do,
    })
    return ok(res, phien, 'Đã đính chính hồ sơ')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message, err.data ?? null)
  }
}

// POST /api/doctor/exam-session/:queueId/notify-reception
export async function notifyReception(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const noiDung = String(req.body?.noi_dung ?? '').trim()
    const mucDo = ['urgent', 'warning', 'info'].includes(req.body?.muc_do) ? req.body.muc_do : 'warning'
    if (!noiDung) return fail(res, 400, 'Vui lòng nhập nội dung cần báo lễ tân')
    if (noiDung.length > 1000) return fail(res, 400, 'Nội dung thông báo tối đa 1000 ký tự')

    const entry = await HangDoi.findOne({ _id: req.params.queueId, doctor_id: docId }).lean()
    if (!entry) return fail(res, 404, 'Không tìm thấy lượt khám của bác sĩ')

    const receptionists = await NguoiDung.find({ role: 'receptionist', status: 'active' }).select('_id').lean()
    if (receptionists.length === 0) return fail(res, 404, 'Chưa có tài khoản lễ tân đang hoạt động')

    const titleByPriority = {
      urgent: 'Bác sĩ báo khẩn',
      warning: 'Bác sĩ cần lễ tân xử lý',
      info: 'Cập nhật từ phòng khám',
    }
    const notifications = await ThongBao.insertMany(receptionists.map((receptionist) => ({
      user_id: receptionist._id,
      tieu_de: titleByPriority[mucDo],
      noi_dung: `${entry.ten_benh_nhan}: ${noiDung}`,
      loai: 'system',
      related_id: entry._id,
      related_type: 'doctor_reception_message',
      du_lieu_dinh_kem: {
        priority: mucDo,
        source: 'doctor_reception_message',
        queue_id: String(entry._id),
        patient_name: entry.ten_benh_nhan,
        room: entry.phong_kham ?? null,
        url: '/receptionist/dashboard',
      },
      ngay_gui_du_kien: new Date(),
    })))

    return ok(res, { sent: notifications.length }, 'Đã gửi thông báo cho lễ tân')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}
