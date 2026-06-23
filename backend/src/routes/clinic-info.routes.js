import { Router } from 'express'
import * as controller from '../controllers/clinic-info.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Bắt buộc quyền admin
router.use(verifyToken, requireRole('admin'))

router.get('/', controller.getClinicInfo)
router.put('/', controller.updateClinicInfo)

export default router
