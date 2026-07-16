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
// Route '/:id/result/request-revision' đã gỡ 2026-07-16 — bác sĩ sửa trực tiếp khi xác nhận
// (confirmResult nhận kèm body chỉnh sửa). Xem docs/Bác sĩ/Thiet ke - Gop sua va xac nhan...

export default router
