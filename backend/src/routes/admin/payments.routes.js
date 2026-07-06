import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as payments from '../../controllers/admin/payments.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',              payments.list)
router.post('/',             payments.create)
router.get('/:id',           payments.getById)
router.patch('/:id',         payments.update)
router.patch('/:id/refund',  payments.refund)

export default router
