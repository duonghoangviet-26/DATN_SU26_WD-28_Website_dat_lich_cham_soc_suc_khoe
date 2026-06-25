import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as notifications from '../../controllers/admin/notifications.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',   notifications.list)
router.post('/',  notifications.create)

export default router
