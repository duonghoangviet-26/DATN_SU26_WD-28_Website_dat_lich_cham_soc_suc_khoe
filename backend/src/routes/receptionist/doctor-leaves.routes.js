import { Router } from 'express'

import * as controller from '../../controllers/receptionist/doctor-leaves.controller.js'

const router = Router()

router.get('/pending', controller.listPendingLeaves)
router.patch('/:id/approve', controller.approveLeave)
router.patch('/:id/reject', controller.rejectLeave)

export default router
