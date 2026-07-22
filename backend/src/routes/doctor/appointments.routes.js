import { Router } from 'express'
import * as appointments from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',                  appointments.list)
router.get('/pending-results',   appointments.listPendingResults) // phải đứng trước '/:id'
router.get('/:id',               appointments.getById)
router.patch('/:id/confirm',     appointments.confirm)
router.patch('/:id/cancel',      appointments.cancel)
router.patch('/:id/complete',    appointments.complete)
router.get('/:id/result',        appointments.getResult)
router.post('/:id/result',       appointments.createResult)
router.put('/:id/result',        appointments.updateResult)
router.patch('/:id/result/confirm',          appointments.confirmResult)
// KHÔI PHỤC 2026-07-19 (QĐ-1/A, PROMPT 28): bác sĩ đẩy hồ sơ về y tá chỉnh sửa (song song với
// confirmResult "Lưu & Xác nhận"). Xem requestRevision trong controller.
router.patch('/:id/result/request-revision', appointments.requestRevision)

// Xác nhận hồ sơ theo ket_qua_id — dùng cho lượt khám offline (không có LichHen, xem
// confirmResultByRecord trong controller). Path 3 đoạn bắt đầu literal 'result' nên không
// đụng '/:id' (1 đoạn) hay '/:id/result/confirm' (đoạn 3 là 'confirm' khác 'confirm-by-record').
router.patch('/result/:ketQuaId/confirm-by-record', appointments.confirmResultByRecord)

export default router
