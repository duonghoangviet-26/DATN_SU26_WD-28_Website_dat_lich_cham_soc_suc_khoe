import { Router } from 'express'
import * as queue from '../../controllers/doctor/queue.controller.js'
import { examQueue } from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',              examQueue) // giữ nguyên contract GET /api/doctor/queue (Hồ sơ chờ khám)
router.post('/checkin',       queue.checkin)
router.patch('/:id/call',      queue.call)
router.patch('/:id/into-room',  queue.intoRoom)
router.patch('/:id/finish',     queue.finish)
router.patch('/:id/skip',       queue.skip)
router.patch('/:id/cancel',     queue.cancel)

export default router
