import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as dashboard from '../../controllers/admin/dashboard.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', dashboard.getSummary)
router.get('/revenue-details', dashboard.getRevenueDetails)
router.get('/invoiced-details', dashboard.getInvoicedDetails)
router.get('/debt-list', dashboard.getDebtList)
router.post('/remind-debt', dashboard.remindDebt)

export default router
