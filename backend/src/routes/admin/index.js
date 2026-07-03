import { Router } from 'express'
import servicesRoutes      from './services.routes.js'
import specialtiesRoutes   from './specialties.routes.js'
import userRoutes          from './user.routes.js'
import doctorsRoutes       from './doctors.routes.js'
import reviewRoutes        from './review.routes.js'
import notificationsRoutes from './notifications.routes.js'
import paymentsRoutes      from './payments.routes.js'
import slotsRoutes         from './slots.routes.js'

// ============================================================
// Admin routes — mount tại /api/admin
// Lưu ý: /admin/appointments được mount riêng ở routes/index.js
// (dùng appointment.routes.js — bản real API, thay cho appointments.routes.js cũ)
// ============================================================

const router = Router()

router.use('/services',      servicesRoutes)       // C4
router.use('/specialties',   specialtiesRoutes)     // C3
router.use('/users',         userRoutes)            // C1
router.use('/doctors',       doctorsRoutes)         // C2
router.use('/reviews',       reviewRoutes)          // C6
router.use('/notifications', notificationsRoutes)   // C7
router.use('/payments',      paymentsRoutes)        // C8
router.use('/slots',         slotsRoutes)           // B2 — sinh lịch thủ công (fallback cron)

export default router
