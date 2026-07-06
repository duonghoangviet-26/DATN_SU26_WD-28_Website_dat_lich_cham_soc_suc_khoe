import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/guest-patients.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', controller.listGuestPatients)
router.post('/', controller.createGuestPatient)
router.get('/:id', controller.getGuestPatientById)
router.put('/:id', controller.updateGuestPatient)

export default router
