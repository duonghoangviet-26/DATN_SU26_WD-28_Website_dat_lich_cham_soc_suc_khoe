import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as dashboard from '../../controllers/admin/dashboard.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', dashboard.getSummary)

export default router
