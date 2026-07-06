import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/refunds.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', controller.list)
router.post('/', controller.createRefund)
router.get('/:id', controller.getById)
router.patch('/:id/approve', controller.approveRefund)
router.patch('/:id/reject', controller.rejectRefund)

export default router
