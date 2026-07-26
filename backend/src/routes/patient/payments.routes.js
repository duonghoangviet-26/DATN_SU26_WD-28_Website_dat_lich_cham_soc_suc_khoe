import { Router } from 'express'
import * as payments from '../../controllers/patient/payments.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

// Public routes (Webhooks & Redirects từ VNPay)
router.get('/vnpay-return', payments.vnpayReturn)
router.get('/vnpay-ipn', payments.vnpayIpn)

// Protected routes (Các API gọi từ máy khách phải có token)
router.use(verifyToken, requireRole('user', 'patient'))
router.get('/:id/status', payments.getPaymentStatus)
router.post('/:id/vnpay-session', payments.createMockVnpaySession)
router.post('/:id/vnpay/mock-complete', payments.completeMockVnpayPayment)
router.patch('/:id/confirm', payments.confirmPayment)

export default router
