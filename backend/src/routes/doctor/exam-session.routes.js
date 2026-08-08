import { Router } from 'express'
import { get, saveStep, complete } from '../../controllers/doctor/exam-session.controller.js'

const router = Router()

router.get('/:queueId', get)
router.patch('/:queueId/step/:buoc', saveStep)
router.post('/:queueId/complete', complete)

export default router
