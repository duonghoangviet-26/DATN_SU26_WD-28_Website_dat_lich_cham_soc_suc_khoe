import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import profileRoutes      from './profile.routes.js'
import scheduleRoutes     from './schedule.routes.js'
import appointmentRoutes  from './appointments.routes.js'
import statsRoutes        from './stats.routes.js'
import leavesRoutes       from './leaves.routes.js'
import queueRoutes        from './queue.routes.js'
import roomStatusRoutes   from './room-status.routes.js'
import examSessionRoutes  from './exam-session.routes.js'
import { list as queueEntriesList } from '../../controllers/doctor/queue.controller.js'

// ============================================================
// Doctor routes — mount tại /api/doctor
// Toàn bộ route đều yêu cầu role='doctor'
// ============================================================

const router = Router()
router.use(verifyToken, requireRole('doctor'))

// /api/doctor/queue: GET (Hồ sơ chờ khám, giữ nguyên contract cũ) + check-in/call/into-room/
// finish/skip/cancel (hàng đợi động — trước đây do y tá đảm nhiệm, nay bác sĩ tự thao tác).
router.use('/queue',         queueRoutes)
// WS-1 — Phiên khám 4 bước. `verifyToken` + `requireRole('doctor')` đã áp ở đầu file.
router.use('/exam-session',  examSessionRoutes)
// Hàng đợi động chi tiết (kèm thời gian chờ ước tính) — dùng cho action gọi/vào phòng/kết thúc.
router.get('/queue-entries', queueEntriesList)
router.use('/room-status',   roomStatusRoutes)
router.use('/profile',       profileRoutes)
router.use('/schedule',      scheduleRoutes)
router.use('/appointments',  appointmentRoutes)
router.use('/stats',         statsRoutes)
router.use('/leaves',        leavesRoutes)

export default router
