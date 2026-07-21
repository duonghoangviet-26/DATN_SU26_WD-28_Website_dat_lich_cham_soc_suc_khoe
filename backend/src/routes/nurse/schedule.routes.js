import { Router } from 'express'
import * as schedule from '../../controllers/nurse/schedule.controller.js'

const router = Router()

router.get('/', schedule.list)

export default router
