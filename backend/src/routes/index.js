import { Router } from 'express'
import authRoutes from './auth.routes.js'
import clinicRoutes from './clinic.routes.js'
import adminRoutes from './admin/index.js'

// Gom toàn bộ route con vào đây. Thêm module mới: import rồi router.use('/ten', ...).
const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API khỏe mạnh', data: { time: new Date() } })
})

router.use('/auth', authRoutes)
router.use('/admin/clinic', clinicRoutes) // C3: Phòng Khám & Chuyên Khoa
router.use('/admin', adminRoutes)

export default router

