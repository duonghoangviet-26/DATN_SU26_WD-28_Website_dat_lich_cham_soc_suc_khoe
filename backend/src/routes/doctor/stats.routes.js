import { Router } from 'express'
import { getStats, getReviews } from '../../controllers/doctor/stats.controller.js'

const router = Router()

router.get('/',        getStats)
router.get('/reviews', getReviews)

export default router
