import { Router } from 'express'
import authRoutes    from './admin/auth.routes.js'
import adminRoutes   from './admin/index.js'
import doctorRoutes  from './doctor/index.js'
import patientRoutes from './patient/index.js'
import clinicRoutes from './admin/clinic.routes.js'
import uploadRoutes from './admin/upload.routes.js'
import clinicInfoRoutes from './admin/clinic-info.routes.js'
import appointmentRoutes from './admin/appointment.routes.js'

/**
 * Gom toàn bộ route con của hệ thống
 */
const router = Router()

// Kiểm tra health-check cơ bản
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is working fine' })
})

router.use('/auth',    authRoutes)
router.use('/doctor',  doctorRoutes)
router.use('/patient', patientRoutes)
router.use('/admin/clinic', clinicRoutes) // C3: Phòng Khám & Chuyên Khoa
router.use('/admin', adminRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/admin/clinic-info', clinicInfoRoutes)
router.use('/admin/appointments', appointmentRoutes)

export default router
