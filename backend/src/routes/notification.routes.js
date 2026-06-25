import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller.js'

const router = Router()

// GET /api/admin/notifications - Lấy danh sách thông báo hệ thống đã gửi
router.get('/', notificationController.getNotifications)

// POST /api/admin/notifications - Gửi thông báo hệ thống mới
router.post('/', notificationController.sendNotification)

export default router
