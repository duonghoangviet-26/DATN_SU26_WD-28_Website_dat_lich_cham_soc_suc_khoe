import { Router } from 'express'
import * as appointments from '../../controllers/nurse/appointments.controller.js'

const router = Router()

router.get('/',    appointments.listQueue)
router.get('/:id', appointments.getById)

export default router
