import { Router } from 'express'
import authRoutes         from './admin/auth.routes.js'
import adminRoutes        from './admin/index.js'
import clinicsRoutes      from './admin/clinics.routes.js'
import notificationRoutes from './admin/notifications.routes.js'
import appointmentRoutes  from './admin/appointment.routes.js'
import specialtiesRoutes  from './admin/specialties.routes.js'
import uploadRoutes       from './admin/upload.routes.js'
import doctorRoutes       from './doctor/index.js'
import adminDoctorRoutes  from './doctor.routes.js'
import receptionistRoutes from './receptionist/index.js'
import patientRoutes      from './patient/index.js'
import thongKeRoutes      from './thong-ke.routes.js'
import newsRoutes         from './news.routes.js'
import chatbotRoutes      from './chatbot.routes.js'
import phanHoiRoutes      from './phanHoiRoutes.js'

const router = Router()

import { getCurrentClinic } from '../controllers/admin/clinic-info.controller.js'

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is working fine' })
})

router.get('/clinic-info', getCurrentClinic)

router.use('/auth', authRoutes)
router.use('/doctor', doctorRoutes)
router.use('/patient', patientRoutes)
router.use('/news', newsRoutes)
router.use('/admin', adminRoutes)
router.use('/thong-ke', thongKeRoutes)
router.use('/chatbot', chatbotRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/phan-hoi', phanHoiRoutes)

// New canonical mounts.
router.use('/admin/clinics', clinicsRoutes)
router.use('/admin/specialties', specialtiesRoutes)

// Legacy mounts preserved temporarily to avoid breaking existing frontend code.
router.use('/admin/clinic-info', clinicsRoutes)
router.use('/admin/clinic-info', specialtiesRoutes)
router.use('/admin/clinic', specialtiesRoutes)

router.use('/admin/appointments', appointmentRoutes)
router.use('/admin/doctors', adminDoctorRoutes)
router.use('/admin/notifications', notificationRoutes)
router.use('/receptionist', receptionistRoutes)

export default router
