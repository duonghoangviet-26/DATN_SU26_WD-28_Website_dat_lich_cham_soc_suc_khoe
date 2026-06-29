import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as specialties from '../../controllers/admin/specialties.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))
router.get('/', specialties.list)
export default router
