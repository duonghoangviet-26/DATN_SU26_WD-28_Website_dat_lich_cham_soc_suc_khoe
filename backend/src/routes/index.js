import { Router } from 'express'
import authRoutes from './auth.routes.js'
import doctorRoutes from './doctor.routes.js'
import notificationRoutes from './notification.routes.js'

// Gom toàn bộ route con vào đây. Thêm module mới: import rồi router.use('/ten', ...).
const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API khỏe mạnh', data: { time: new Date() } })
})

router.use('/auth', authRoutes)
router.use('/admin/doctors', doctorRoutes)
router.use('/admin/notifications', notificationRoutes)
// router.use('/admin/users', userRoutes)   // ví dụ thêm module sau
// router.use('/appointments', appointmentRoutes)

export default router
