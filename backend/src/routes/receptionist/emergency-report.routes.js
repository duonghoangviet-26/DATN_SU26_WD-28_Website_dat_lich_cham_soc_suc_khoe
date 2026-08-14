import { Router } from 'express'
import { list } from '../../controllers/receptionist/emergency-report.controller.js'

const router = Router()

router.get('/', list)

export default router
