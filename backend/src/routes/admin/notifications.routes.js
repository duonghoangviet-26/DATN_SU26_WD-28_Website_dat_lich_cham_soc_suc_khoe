import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as notificationController from '../../controllers/notification.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', notificationController.getNotifications)
router.get('/received', notificationController.getReceivedNotifications)
router.put('/received/:id/read', notificationController.markNotificationAsRead)
router.post('/', notificationController.sendNotification)
router.put('/:id', notificationController.updateNotification)
router.delete('/:id', notificationController.deleteNotification)
router.get('/:id/logs', notificationController.getNotificationLogs)

export default router
