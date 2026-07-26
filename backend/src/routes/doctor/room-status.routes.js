import { Router } from 'express'
import * as roomStatus from '../../controllers/doctor/room-status.controller.js'

const router = Router()

router.get('/',   roomStatus.list)
router.patch('/', roomStatus.updateStatus)

export default router
