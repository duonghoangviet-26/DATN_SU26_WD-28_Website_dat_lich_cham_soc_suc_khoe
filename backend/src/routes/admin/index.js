import { Router } from 'express'
import servicesRoutes      from './services.routes.js'
import specialtiesRoutes   from './specialties.routes.js'
import userRoutes          from './user.routes.js'
import reviewRoutes        from './review.routes.js'
import paymentsRoutes      from './payments.routes.js'
import refundsRoutes       from './refunds.routes.js'
import slotsRoutes         from './slots.routes.js'
import invoicesRoutes      from './invoices.routes.js'
import clinicConfigRoutes  from './clinic-config.routes.js'
import guestPatientsRoutes from './guest-patients.routes.js'
import doctorLeavesRoutes  from './doctor-leaves.routes.js'
import medicalReadRoutes   from './medical-read.routes.js'
import dashboardRoutes     from './dashboard.routes.js'
import patientRoutes       from './patient.routes.js'
import scheduleTemplatesRoutes from './schedule-templates.routes.js'
import rescheduleApprovalsRoutes from './reschedule-approvals.routes.js'
import newsRoutes          from './news.routes.js'
import searchRoutes        from './search.routes.js'

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
router.use('/patients',      patientRoutes)
router.use('/reviews',       reviewRoutes)          // C6
router.use('/payments',      paymentsRoutes)        // C8
router.use('/refunds',       refundsRoutes)
router.use('/slots',         slotsRoutes)           // B2 — sinh lịch thủ công (fallback cron)
router.use('/schedule-templates', scheduleTemplatesRoutes) // Mẫu đăng ký ca của bác sĩ (rule mục 3)
router.use('/reschedule-approvals', rescheduleApprovalsRoutes) // Duyệt phương án dời lịch (rule mục 15)
router.use('/invoices',      invoicesRoutes)
router.use('/clinic-config', clinicConfigRoutes)
router.use('/guest-patients', guestPatientsRoutes)
router.use('/doctor-leaves', doctorLeavesRoutes)
router.use('/medical-read', medicalReadRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/news', newsRoutes)
router.use('/search', searchRoutes)

export default router
