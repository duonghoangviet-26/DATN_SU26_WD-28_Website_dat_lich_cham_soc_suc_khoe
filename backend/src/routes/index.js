import { Router } from 'express'
import authRoutes  from './admin/auth.routes.js'
import adminRoutes from './admin/index.js'
import uploadRoutes from './upload.routes.js'
import clinicInfoRoutes from './clinic-info.routes.js'

/**
 * Gom toàn bộ route con của hệ thống
 */
const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API khỏe mạnh', data: { time: new Date() } })
})

router.use('/auth',  authRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/admin/clinic-info', clinicInfoRoutes)

export default router
