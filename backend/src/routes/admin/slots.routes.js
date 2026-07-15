import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as slots from '../../controllers/admin/slots.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.post('/', slots.createSchedule)
router.post('/ensure-day', slots.ensureDoctorWorkday)
router.get('/calendar', slots.getDoctorWorkdays)
router.get('/audit-logs', slots.getAuditLogs)
router.patch('/:id/workday', slots.updateWorkday)
router.get('/:id', slots.getScheduleById)
router.patch('/:id/slots/:slotId', slots.updateSlot)
router.post('/generate', slots.generate)

export default router
