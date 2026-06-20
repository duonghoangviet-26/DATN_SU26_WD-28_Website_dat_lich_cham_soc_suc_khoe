import { Router } from 'express'
import servicesRoutes from './services.routes.js'

// ============================================================
// Admin routes — mount tại /api/admin
// Thêm route mới: import rồi router.use('/ten', ...)
// ============================================================
// Đã có:
//   C4: /api/admin/services  → services.routes.js
//
// Chờ các thành viên:
//   C1: /api/admin/users
//   C2: /api/admin/doctors
//   C3: /api/admin/specialties
//   C5: /api/admin/appointments
//   C6: /api/admin/reviews
//   C7: /api/admin/notifications
//   C8: /api/admin/payments
// ============================================================

const router = Router()

router.use('/services', servicesRoutes)

export default router
