import { Router } from 'express'
import paymentController from '../../controllers/receptionist/payment.controller.js'

const router = Router()

router.get('/', paymentController.getPayments)
router.patch('/:id/confirm-cash', paymentController.confirmCashPayment)
router.post('/:id/refund', paymentController.refundPayment)

export default router
