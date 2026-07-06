import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/doctor-leaves.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', controller.listDoctorLeaves)
router.post('/', controller.createDoctorLeave)
router.patch('/:id/approve', controller.approveDoctorLeave)
router.patch('/:id/reject', controller.rejectDoctorLeave)

export default router
