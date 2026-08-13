import { BacSi } from '../../models/index.js'
import {
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
