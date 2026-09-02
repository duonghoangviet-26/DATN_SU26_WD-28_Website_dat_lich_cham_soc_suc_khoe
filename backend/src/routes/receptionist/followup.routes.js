import { Router } from 'express'
import * as followupController from '../../controllers/receptionist/followup.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', verifyToken, requireRole('receptionist', 'admin'), followupController.getAllFollowUps)

export default router
