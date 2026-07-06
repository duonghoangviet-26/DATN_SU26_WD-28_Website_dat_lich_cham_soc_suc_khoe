import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/invoices.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', controller.listInvoices)
router.get('/:id', controller.getInvoiceById)
router.patch('/:id', controller.updateInvoice)
router.post('/:id/recalculate', controller.recalculateInvoiceStatus)

export default router
