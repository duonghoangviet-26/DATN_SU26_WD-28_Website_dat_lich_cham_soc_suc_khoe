import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as approvals from '../../controllers/admin/reschedule-approval.controller.js'

// Duyệt phương án dời lịch cho khách ĐÃ THANH TOÁN (rule mục 15).
// Chốt 2026-08-22: mở thêm cho lễ tân — cùng router này được mount thêm một lần dưới
// routes/receptionist/index.js, kế thừa requireRole('receptionist','admin') ở đó. Ở đây
// vẫn giữ requireRole rộng để router hoạt động đúng cả khi bị mount trực tiếp dưới /admin.
const router = Router()
router.use(verifyToken, requireRole('admin', 'receptionist'))

router.get('/', approvals.list)
router.get('/:id/free-slots', approvals.freeSlots)
router.patch('/:id/approve', approvals.approve)
router.patch('/:id/reject', approvals.reject)
router.patch('/:id/chon-tay', approvals.chonTay)

export default router
