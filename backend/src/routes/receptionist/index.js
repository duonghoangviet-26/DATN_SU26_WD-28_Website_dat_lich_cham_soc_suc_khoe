import { Router } from 'express'
import appointmentRoutes from './appointment.routes.js'
import paymentRoutes from './payment.routes.js'

const router = Router()

// Bọc middleware kiểm tra quyền lễ tân tại đây sau (ví dụ: role === 'admin' || role === 'receptionist')
router.use('/appointments', appointmentRoutes)
router.use('/payments', paymentRoutes)

export default router
