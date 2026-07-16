import { Router } from 'express'
import * as roomStatus from '../../controllers/nurse/room-status.controller.js'

const router = Router()

router.get('/', roomStatus.list)
router.patch('/:doctorId', roomStatus.updateStatus)

export default router
