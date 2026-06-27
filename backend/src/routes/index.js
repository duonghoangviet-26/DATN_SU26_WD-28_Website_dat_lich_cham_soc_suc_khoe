import { Router } from 'express'
import authRoutes from './admin/auth.routes.js'
import adminRoutes from './admin/index.js'

/**
 * Gom toàn bộ route con của hệ thống
 */
const router = Router()

// Route kiểm tra trạng thái hệ thống
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API VitaFamily khỏe mạnh', data: { time: new Date() } })
})

// Đăng ký các module
router.use('/auth', authRoutes)
router.use('/admin', adminRoutes)

export default router
