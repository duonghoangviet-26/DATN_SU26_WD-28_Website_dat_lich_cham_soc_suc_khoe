import { Router } from 'express'
import paymentController from '../../controllers/receptionist/payment.controller.js'

const router = Router()

router.get('/', paymentController.getPayments)
router.patch('/:id/confirm-cash', paymentController.confirmCashPayment)
router.post('/:id/refund', paymentController.refundPayment)

router.get('/:id/status', paymentController.getPaymentStatus)
router.post('/:id/vnpay-session', paymentController.createMockVnpaySession)
router.post('/:id/vnpay/mock-complete', paymentController.completeMockVnpayPayment)

export default router
