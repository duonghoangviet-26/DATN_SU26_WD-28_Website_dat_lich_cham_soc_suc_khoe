import { Router } from 'express'
import * as notifications from '../../controllers/patient/notifications.controller.js'

const router = Router()

router.get('/',                       notifications.listNotifications)
router.get('/unread-count',           notifications.getUnreadCount)
router.patch('/read-all',             notifications.markAllRead)
router.patch('/:id/read',             notifications.markRead)

export default router
