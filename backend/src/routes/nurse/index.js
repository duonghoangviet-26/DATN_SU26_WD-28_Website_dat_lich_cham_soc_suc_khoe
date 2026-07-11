import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import dashboardRoutes from './dashboard.routes.js'
import appointmentsRoutes from './appointments.routes.js'
import medicalRecordsRoutes from './medical-records.routes.js'

// ============================================================
// Nurse routes — mount tại /api/nurse
// Toàn bộ route đều yêu cầu role='nurse'
// ============================================================

const router = Router()
router.use(verifyToken, requireRole('nurse'))

router.use('/dashboard',        dashboardRoutes)
router.use('/appointments',     appointmentsRoutes)
router.use('/medical-records',  medicalRecordsRoutes)

export default router
