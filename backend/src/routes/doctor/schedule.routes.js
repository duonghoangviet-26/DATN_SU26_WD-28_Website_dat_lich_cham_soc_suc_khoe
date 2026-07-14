import { Router } from 'express'
import * as schedule from '../../controllers/doctor/schedule.controller.js'

const router = Router()

// Bác sĩ KHÔNG được tự tạo/xóa lịch (spec v3, "Chống gian lận" — B2 doc mục "Thay đổi lớn so với v2").
// Lịch do hệ thống tự sinh — xem scheduleGenerator.service.js + POST /api/admin/slots/generate.
router.get('/',                                       schedule.getSchedules)
router.get('/:scheduleId',                            schedule.getScheduleDetail)
router.post('/:scheduleId/slots/:slotId/request-cancel', schedule.requestCancelSlot)

export default router
