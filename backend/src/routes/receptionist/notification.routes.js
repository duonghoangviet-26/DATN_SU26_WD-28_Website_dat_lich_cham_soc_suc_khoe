import { Router } from 'express'
import * as notificationController from '../../controllers/receptionist/notification.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken, requireRole('receptionist', 'admin'))

router.get('/recent', notificationController.getRecentNotifications)

export default router
