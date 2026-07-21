import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import dashboardRoutes from './dashboard.routes.js'
import appointmentsRoutes from './appointments.routes.js'
import medicalRecordsRoutes from './medical-records.routes.js'
import roomStatusRoutes from './room-status.routes.js'
import queueRoutes from './queue.routes.js'
import scheduleRoutes from './schedule.routes.js'

// ============================================================
// Nurse routes — mount tại /api/nurse
// Toàn bộ route đều yêu cầu role='nurse'
// ============================================================

const router = Router()
router.use(verifyToken, requireRole('nurse'))

router.use('/dashboard',        dashboardRoutes)
router.use('/schedule',         scheduleRoutes)
router.use('/appointments',     appointmentsRoutes)
router.use('/medical-records',  medicalRecordsRoutes)
router.use('/room-status',      roomStatusRoutes)
router.use('/queue',            queueRoutes)

export default router
