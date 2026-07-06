import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/clinic-config.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', controller.getClinicConfig)
router.post('/', controller.createClinicConfig)
router.put('/', controller.updateClinicConfig)

export default router
