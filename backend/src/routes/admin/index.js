import { Router } from 'express'
import servicesRoutes      from './services.routes.js'
import specialtiesRoutes   from './specialties.routes.js'
import userRoutes          from './user.routes.js'
import reviewRoutes        from './review.routes.js'
import paymentsRoutes      from './payments.routes.js'
import slotsRoutes         from './slots.routes.js'
import invoicesRoutes      from './invoices.routes.js'
import refundsRoutes       from './refunds.routes.js'
import clinicConfigRoutes  from './clinic-config.routes.js'
import guestPatientsRoutes from './guest-patients.routes.js'
import doctorLeavesRoutes  from './doctor-leaves.routes.js'
import medicalReadRoutes   from './medical-read.routes.js'

// ============================================================
// Admin routes — mount tại /api/admin
// Lưu ý:
//   - /admin/appointments được mount riêng ở routes/index.js
//     (dùng appointment.routes.js — bản real API, thay cho appointments.routes.js cũ)
//   - /admin/doctors và /admin/notifications cũng mount riêng ở routes/index.js
//     (dùng doctor.routes.js / notification.routes.js — bản đầy đủ, thay cho
//     doctors.routes.js / notifications.routes.js cũ đã bị xóa để tránh double-mount)
// ============================================================

const router = Router()

router.use('/services',      servicesRoutes)       // C4
router.use('/specialties',   specialtiesRoutes)     // C3
router.use('/users',         userRoutes)            // C1
router.use('/reviews',       reviewRoutes)          // C6
router.use('/payments',      paymentsRoutes)        // C8
router.use('/slots',         slotsRoutes)           // B2 — sinh lịch thủ công (fallback cron)
router.use('/invoices',      invoicesRoutes)
router.use('/refunds',       refundsRoutes)
router.use('/clinic-config', clinicConfigRoutes)
router.use('/guest-patients', guestPatientsRoutes)
router.use('/doctor-leaves', doctorLeavesRoutes)
router.use('/medical-read', medicalReadRoutes)

export default router
