import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import appointmentRoutes from './appointment.routes.js'
import paymentRoutes from './payment.routes.js'
import bookingRoutes from './booking.routes.js'
import newsRoutes from './news.routes.js'

import notificationRoutes from './notification.routes.js'

import userRoutes from './user.routes.js'
import patientIntakeRoutes from './patient-intake.routes.js'
import offlinePaymentRoutes from './offline-payment.routes.js'
import billingRoutes from './billing.routes.js'

const router = Router()

// ============================================================
// Receptionist routes — mount tai /api/receptionist
// ============================================================
// Truoc 2026-07-26 cho nay chi co mot dong TODO "boc middleware sau", nen TOAN BO route le tan
// goi duoc MA KHONG CAN TOKEN: bat ky ai biet URL cung huy duoc lich hen, doi lich, check-in
// benh nhan, xac nhan da thu tien mat, hoac tra danh sach benh nhan kem so dien thoai.
//
// `requireRole('receptionist', 'admin')` khop dung guard cua frontend
// (`ProtectedRoute roles={['receptionist','admin']}` trong AppRoutes.tsx) nen khong lam vo
// giao dien dang co. axiosInstance da tu gan `Authorization` cho moi request.
//
// verifyToken PHAI dat truoc requireRole (quy uoc trong auth.middleware.js).
router.use(verifyToken, requireRole('receptionist', 'admin'))

router.use('/appointments', appointmentRoutes)
router.use('/payments/cases', billingRoutes)
router.use('/payments', paymentRoutes)
router.use('/booking', bookingRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)
router.use('/patient-intake', patientIntakeRoutes)
router.use('/payments/offline', offlinePaymentRoutes)
router.use('/news', newsRoutes)

export default router
