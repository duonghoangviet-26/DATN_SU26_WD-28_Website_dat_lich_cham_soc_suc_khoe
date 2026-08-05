import { Router } from 'express'
import { getTimeline } from '../../controllers/receptionist/timeline.controller.js'

const router = Router()

router.get('/', getTimeline)

export default router
