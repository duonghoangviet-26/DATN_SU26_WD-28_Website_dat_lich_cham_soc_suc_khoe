import { Router } from 'express'
import * as billing from '../../controllers/receptionist/billing.controller.js'

const router = Router()

router.get('/', billing.listBillingCases)
router.get('/:referenceId', billing.getBillingCase)
router.post('/:referenceId/invoice', billing.createBillingInvoice)
router.patch('/:referenceId/payments/:paymentId/confirm', billing.confirmTransfer)
router.patch('/:referenceId/payments/:paymentId/cancel', billing.cancelTransfer)
router.post('/:referenceId/receipt-print', billing.markReceiptPrinted)

export default router
