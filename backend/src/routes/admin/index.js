import { Router } from 'express'
import servicesRoutes from './services.routes.js'
import specialtiesRoutes from './specialties.routes.js'
import userRoutes from '../user.routes.js'
import reviewRoutes from './review.routes.js'

const router = Router()

router.use('/users', userRoutes)
router.use('/services', servicesRoutes)
router.use('/specialties', specialtiesRoutes)
router.use('/reviews', reviewRoutes)

export default router
