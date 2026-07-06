import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as slots from '../../controllers/admin/slots.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.post('/', slots.createSchedule)
router.get('/:id', slots.getScheduleById)
router.patch('/:id/slots/:slotId', slots.updateSlot)
router.post('/generate', slots.generate)

export default router
