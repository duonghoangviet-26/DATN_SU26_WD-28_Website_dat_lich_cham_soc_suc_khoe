import { Router } from 'express'
import authRoutes    from './auth.routes.js'
import adminRoutes   from './admin/index.js'
import doctorRoutes  from './doctor/index.js'
import patientRoutes from './patient/index.js'

// Gom toàn bộ route con vào đây. Thêm module mới: import rồi router.use('/ten', ...).
const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API khỏe mạnh', data: { time: new Date() } })
})

router.use('/auth',    authRoutes)
router.use('/admin',   adminRoutes)
router.use('/doctor',  doctorRoutes)
router.use('/patient', patientRoutes)

export default router
