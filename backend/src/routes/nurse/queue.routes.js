import { Router } from 'express'
import * as queue from '../../controllers/nurse/queue.controller.js'

const router = Router()

router.get('/', queue.list)
router.post('/checkin', queue.checkin)
router.patch('/:id/call', queue.call)
router.patch('/:id/into-room', queue.intoRoom)
router.patch('/:id/finish', queue.finish)
router.patch('/:id/skip', queue.skip)
router.patch('/:id/cancel', queue.cancel)

export default router
