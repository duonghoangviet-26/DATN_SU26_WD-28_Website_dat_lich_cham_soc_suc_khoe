import { Router } from 'express'
import { listMyLeaveRequests, createLeaveRequest, cancelLeaveRequest } from '../../controllers/doctor/leaves.controller.js'

const router = Router()

router.get('/',            listMyLeaveRequests)
router.post('/',           createLeaveRequest)
router.patch('/:id/cancel', cancelLeaveRequest)

export default router
