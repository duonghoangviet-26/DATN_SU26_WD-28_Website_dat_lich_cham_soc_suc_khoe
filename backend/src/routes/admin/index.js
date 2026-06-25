import { Router } from 'express'
import servicesRoutes      from './services.routes.js'
import specialtiesRoutes   from './specialties.routes.js'
import usersRoutes         from './users.routes.js'
import doctorsRoutes       from './doctors.routes.js'
import appointmentsRoutes  from './appointments.routes.js'
import reviewsRoutes       from './reviews.routes.js'
import notificationsRoutes from './notifications.routes.js'
import paymentsRoutes      from './payments.routes.js'

// ============================================================
// Admin routes — mount tại /api/admin
// ============================================================

const router = Router()

router.use('/services',      servicesRoutes)       // C4
router.use('/specialties',   specialtiesRoutes)     // C3
router.use('/users',         usersRoutes)           // C1
router.use('/doctors',       doctorsRoutes)         // C2
router.use('/appointments',  appointmentsRoutes)    // C5
router.use('/reviews',       reviewsRoutes)         // C6
router.use('/notifications', notificationsRoutes)   // C7
router.use('/payments',      paymentsRoutes)        // C8

export default router
