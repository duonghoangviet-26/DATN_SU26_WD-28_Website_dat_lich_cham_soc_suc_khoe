import { Router } from 'express'
import * as appointments from '../../controllers/nurse/appointments.controller.js'

const router = Router()

router.get('/',                appointments.listQueue)
router.get('/pending-records', appointments.pendingRecords) // phải trước '/:id'
router.get('/:id',             appointments.getById)

export default router
