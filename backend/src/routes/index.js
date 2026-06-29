import { Router } from 'express'
<<<<<<< HEAD
import authRoutes from './auth.routes.js'
import doctorRoutes from './doctor.routes.js'
import notificationRoutes from './notification.routes.js'
=======
import authRoutes  from './admin/auth.routes.js'
import adminRoutes from './admin/index.js'
import uploadRoutes from './upload.routes.js'
import clinicInfoRoutes from './clinic-info.routes.js'
>>>>>>> 6225679c4a67209eae042dc8a2ac37e776d1569b

/**
 * Gom toàn bộ route con của hệ thống
 */
const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API khỏe mạnh', data: { time: new Date() } })
})

<<<<<<< HEAD
router.use('/auth', authRoutes)
router.use('/admin/doctors', doctorRoutes)
router.use('/admin/notifications', notificationRoutes)
// router.use('/admin/users', userRoutes)   // ví dụ thêm module sau
// router.use('/appointments', appointmentRoutes)
=======
router.use('/auth',  authRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/admin/clinic-info', clinicInfoRoutes)
>>>>>>> 6225679c4a67209eae042dc8a2ac37e776d1569b

export default router
