import { Router } from 'express'
import * as appointments from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',                  appointments.list)
router.get('/:id',               appointments.getById)
router.patch('/:id/confirm',     appointments.confirm)
router.patch('/:id/cancel',      appointments.cancel)
router.get('/:id/result',        appointments.getResult)
router.post('/:id/result',       appointments.createResult)
router.put('/:id/result',        appointments.updateResult)

export default router
