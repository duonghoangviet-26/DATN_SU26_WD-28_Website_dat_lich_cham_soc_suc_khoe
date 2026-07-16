import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import profileRoutes      from './profile.routes.js'
import scheduleRoutes     from './schedule.routes.js'
import appointmentRoutes  from './appointments.routes.js'
import statsRoutes        from './stats.routes.js'
import leavesRoutes       from './leaves.routes.js'

// ============================================================
// Doctor routes — mount tại /api/doctor
// Toàn bộ route đều yêu cầu role='doctor'
// ============================================================

const router = Router()
router.use(verifyToken, requireRole('doctor'))

router.use('/profile',       profileRoutes)
router.use('/schedule',      scheduleRoutes)
router.use('/appointments',  appointmentRoutes)
router.use('/stats',         statsRoutes)
router.use('/leaves',        leavesRoutes)

export default router
