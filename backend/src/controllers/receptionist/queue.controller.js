import { ok, fail } from '../../utils/response.js'
import { transferQueueEntry } from '../../services/queueTransfer.service.js'
import { huyLuotHangDoi } from '../../services/queueCancel.service.js'

// PATCH /api/receptionist/queue/:id/transfer — E-4, xem services/queueTransfer.service.js
export const transferQueue = async (req, res) => {
  try {
    const result = await transferQueueEntry({
      entryId: req.params.id,
      doctorIdMoi: req.body?.doctor_id_moi,
      lyDo: req.body?.ly_do,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
    })
    return ok(res, result, 'Đã chuyển lượt sang bác sĩ khác')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

// PATCH /api/receptionist/queue/:id/cancel — E-11, xem services/queueCancel.service.js
export const cancelQueue = async (req, res) => {
  try {
    const result = await huyLuotHangDoi({
      entryId: req.params.id,
      lyDo: req.body?.ly_do,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      actorRole: 'receptionist',
    })
    return ok(res, result, 'Đã đóng lượt chờ')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export default { transferQueue, cancelQueue }
