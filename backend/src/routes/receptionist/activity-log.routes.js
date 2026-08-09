import { Router } from 'express'
import { list } from '../../controllers/receptionist/activity-log.controller.js'

const router = Router()

router.get('/', list)

export default router
