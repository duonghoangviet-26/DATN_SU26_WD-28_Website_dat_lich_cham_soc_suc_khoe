import { Router } from 'express'
import { amend, get, saveStep, complete } from '../../controllers/doctor/exam-session.controller.js'

const router = Router()

router.get('/:queueId', get)
router.patch('/:queueId/step/:buoc', saveStep)
router.post('/:queueId/complete', complete)
// B54/B55 — đính chính hồ sơ ĐÃ XÁC NHẬN, khác PATCH .../step/:buoc (chỉ dùng khi chưa xác nhận).
router.patch('/:queueId/amendment', amend)

export default router
