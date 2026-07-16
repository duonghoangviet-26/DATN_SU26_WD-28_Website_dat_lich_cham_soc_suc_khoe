import { Router } from 'express'
import { getStats, getReviews, getTodayOverview } from '../../controllers/doctor/stats.controller.js'

const router = Router()

router.get('/',        getStats)
router.get('/reviews', getReviews)
router.get('/today',   getTodayOverview)

export default router
