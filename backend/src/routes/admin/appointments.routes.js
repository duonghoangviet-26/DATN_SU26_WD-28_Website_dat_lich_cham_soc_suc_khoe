import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as appointments from '../../controllers/admin/appointments.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',              appointments.list)
router.get('/:id',           appointments.getById)
router.patch('/:id/cancel',  appointments.cancel)
router.patch('/:id/complete', appointments.complete)
router.patch('/:id/assign-home-staff', appointments.assignHomeStaff)
router.patch('/:id/result',            appointments.uploadHomeResult)

export default router
