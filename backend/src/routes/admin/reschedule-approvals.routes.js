import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as approvals from '../../controllers/admin/reschedule-approval.controller.js'

// Duyệt phương án dời lịch cho khách ĐÃ THANH TOÁN (rule mục 15).
const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/', approvals.list)
router.patch('/:id/approve', approvals.approve)
router.patch('/:id/reject', approvals.reject)

export default router
