import { Router } from 'express'
import authRoutes from './auth.routes.js'
import clinicRoutes from './clinic.routes.js'
import adminRoutes from './admin/index.js'
import uploadRoutes from './upload.routes.js'
import clinicInfoRoutes from './clinic-info.routes.js'

// Gom toàn bộ route con vào đây. Thêm module mới: import rồi router.use('/ten', ...).
const router = Router()

// Kiểm tra health-check cơ bản
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is working fine' })
})

router.use('/auth', authRoutes)
router.use('/admin/clinic', clinicRoutes) // C3: Phòng Khám & Chuyên Khoa
router.use('/admin/clinic-info', clinicInfoRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/admin', adminRoutes)

export default router
