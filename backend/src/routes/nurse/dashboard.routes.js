import { Router } from 'express'
import * as dashboard from '../../controllers/nurse/dashboard.controller.js'

const router = Router()

router.get('/', dashboard.getDashboard)

export default router
