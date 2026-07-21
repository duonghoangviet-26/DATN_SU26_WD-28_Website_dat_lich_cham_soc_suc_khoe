import { Router } from 'express'
import appointmentRoutes from './appointment.routes.js'
import paymentRoutes from './payment.routes.js'
import bookingRoutes from './booking.routes.js'

import notificationRoutes from './notification.routes.js'

import userRoutes from './user.routes.js'

const router = Router()

// Bọc middleware kiểm tra quyền lễ tân tại đây sau (ví dụ: role === 'admin' || role === 'receptionist')
router.use('/appointments', appointmentRoutes)
router.use('/payments', paymentRoutes)
router.use('/booking', bookingRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)

export default router
