import { Router } from 'express'

import * as refunds from '../../controllers/admin/refunds.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', refunds.listRefunds)
router.post('/', refunds.createRefund)
router.get('/:id', refunds.getRefundById)
router.patch('/:id/approve', refunds.approveRefund)
router.patch('/:id/reject', refunds.rejectRefund)

export default router
