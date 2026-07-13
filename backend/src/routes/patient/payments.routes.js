import { Router } from 'express'
import * as payments from '../../controllers/patient/payments.controller.js'

const router = Router()

router.get('/:id/status', payments.getPaymentStatus)
router.post('/:id/vnpay-session', payments.createMockVnpaySession)
router.post('/:id/vnpay/mock-complete', payments.completeMockVnpayPayment)
router.patch('/:id/confirm', payments.confirmPayment)

export default router
