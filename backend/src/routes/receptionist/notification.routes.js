import { Router } from 'express'
import * as notificationController from '../../controllers/receptionist/notification.controller.js'

const router = Router()

router.get('/recent', notificationController.getRecentNotifications)

export default router
