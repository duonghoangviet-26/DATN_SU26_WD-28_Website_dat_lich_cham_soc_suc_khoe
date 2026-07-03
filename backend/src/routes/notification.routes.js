import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller.js'

const router = Router()

// GET /api/admin/notifications - Lấy danh sách thông báo hệ thống đã gửi
router.get('/', notificationController.getNotifications)

// GET /api/admin/notifications/received - Lấy danh sách thông báo gửi đến Admin
router.get('/received', notificationController.getReceivedNotifications)

// POST /api/admin/notifications - Gửi thông báo hệ thống mới
router.post('/', notificationController.sendNotification)

// PUT /api/admin/notifications/:id - Cập nhật nội dung thông báo đã gửi
router.put('/:id', notificationController.updateNotification)

// DELETE /api/admin/notifications/:id - Xóa thông báo đã gửi
router.delete('/:id', notificationController.deleteNotification)

// PUT /api/admin/notifications/received/:id/read - Đánh dấu thông báo đã xem
router.put('/received/:id/read', notificationController.markNotificationAsRead)

export default router
