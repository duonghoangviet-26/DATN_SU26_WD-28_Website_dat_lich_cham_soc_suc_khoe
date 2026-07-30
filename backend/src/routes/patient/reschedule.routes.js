import { Router } from 'express'
import * as reschedule from '../../controllers/patient/reschedule.controller.js'

// Dời lịch (rule mục 5, 14, 15). KHÔNG hoàn tiền — tiền được bảo toàn dưới dạng quyền dời.
// Auth đã áp ở routes/patient/index.js.
const router = Router()

router.get('/:id/reschedule', reschedule.getRescheduleOptions)
router.post('/:id/reschedule', reschedule.chooseReschedule)

export default router
