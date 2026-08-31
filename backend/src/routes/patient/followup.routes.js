import { Router } from 'express'
import * as followupController from '../../controllers/patient/followup.controller.js'
import { verifyToken, requirePatientRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', verifyToken, requirePatientRole, followupController.getMyFollowUps)

export default router
