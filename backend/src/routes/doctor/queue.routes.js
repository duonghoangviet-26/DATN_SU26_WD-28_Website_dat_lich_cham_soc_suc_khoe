import { Router } from 'express'
import * as queue from '../../controllers/doctor/queue.controller.js'
import { examQueue } from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',              examQueue) // giữ nguyên contract GET /api/doctor/queue (Hồ sơ chờ khám)
// Khách đã đặt hôm nay, chưa vào hàng đợi — nguồn cho nút "Tiếp nhận" ở trang Hồ sơ chờ khám.
router.get('/pending-checkin', queue.pendingCheckin)
router.post('/checkin',       queue.checkin)
router.post('/notify-reception', queue.notifyReceptionGeneral)
router.patch('/:id/call',      queue.call)
router.patch('/:id/into-room',  queue.intoRoom)
router.patch('/:id/finish',     queue.finish)
router.patch('/:id/skip',       queue.skip)
router.patch('/:id/cancel',     queue.cancel)

export default router
