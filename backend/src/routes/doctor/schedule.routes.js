import { Router } from 'express'
import * as schedule from '../../controllers/doctor/schedule.controller.js'

const router = Router()

router.get('/',                                       schedule.getSchedules)
router.post('/',                                      schedule.createSchedule)
router.patch('/:scheduleId/slots/:slotId',            schedule.updateSlot)
router.delete('/:id',                                 schedule.deleteSchedule)

export default router
