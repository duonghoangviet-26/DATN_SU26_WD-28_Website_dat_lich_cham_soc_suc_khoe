import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import familyRoutes        from './family.routes.js'
import recordsRoutes       from './records.routes.js'
import prescriptionsRoutes from './prescriptions.routes.js'
import bookingRoutes       from './booking.routes.js'
import notificationRoutes  from './notifications.routes.js'

// ============================================================
// Patient routes — mount tại /api/patient
// Toàn bộ route đều yêu cầu role='user'
// ============================================================

const router = Router()
router.use(verifyToken, requireRole('user'))

router.use('/family',        familyRoutes)
router.use('/records',       recordsRoutes)
router.use('/prescriptions', prescriptionsRoutes)
router.use('/booking',       bookingRoutes)
router.use('/notifications', notificationRoutes)

export default router
