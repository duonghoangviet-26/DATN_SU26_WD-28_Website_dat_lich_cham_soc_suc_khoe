import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import appointmentRoutes from './appointment.routes.js'
import paymentRoutes from './payment.routes.js'
import bookingRoutes from './booking.routes.js'
import newsRoutes from './news.routes.js'

import notificationRoutes from './notification.routes.js'

import userRoutes from './user.routes.js'
import patientIntakeRoutes from './patient-intake.routes.js'
import offlinePaymentRoutes from './offline-payment.routes.js'
import billingRoutes from './billing.routes.js'
import medicalRecordRoutes from './medical-record.routes.js'
import queueRoutes from './queue.routes.js'
import timelineRoutes from './timeline.routes.js'
import activityLogRoutes from './activity-log.routes.js'
import contactTasksRoutes from './contact-tasks.routes.js'
import doctorLeavesRoutes from './doctor-leaves.routes.js'
import offlineQueueRoutes from './offline-queue.routes.js'
import rescheduleApprovalsRoutes from '../admin/reschedule-approvals.routes.js'

const router = Router()

// ============================================================
// Receptionist routes — mount tai /api/receptionist
// ============================================================
// Truoc 2026-07-26 cho nay chi co mot dong TODO "boc middleware sau", nen TOAN BO route le tan
// goi duoc MA KHONG CAN TOKEN: bat ky ai biet URL cung huy duoc lich hen, doi lich, check-in
// benh nhan, xac nhan da thu tien mat, hoac tra danh sach benh nhan kem so dien thoai.
//
// `requireRole('receptionist', 'admin')` khop dung guard cua frontend
// (`ProtectedRoute roles={['receptionist','admin']}` trong AppRoutes.tsx) nen khong lam vo
// giao dien dang co. axiosInstance da tu gan `Authorization` cho moi request.
//
// verifyToken PHAI dat truoc requireRole (quy uoc trong auth.middleware.js).
router.use(verifyToken, requireRole('receptionist', 'admin'))

router.use('/appointments', appointmentRoutes)
router.use('/payments/cases', billingRoutes)
router.use('/payments', paymentRoutes)
router.use('/booking', bookingRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)
router.use('/patient-intake', patientIntakeRoutes)
router.use('/medical-records', medicalRecordRoutes)
router.use('/queue', queueRoutes)
router.use('/offline-queue', offlineQueueRoutes)
router.use('/timeline', timelineRoutes)
router.use('/activity-log', activityLogRoutes)
router.use('/contact-tasks', contactTasksRoutes)
router.use('/doctor-leaves', doctorLeavesRoutes)
// Duyệt / chọn tay phương án dời lịch cho khách đã thanh toán (rule mục 15, chốt 2026-08-22
// — trước đây chỉ admin duyệt được nhưng không có UI admin nào gọi, đề xuất bị kẹt tới khi
// cron tự áp). Router dùng chung controller với /api/admin/reschedule-approvals.
router.use('/reschedule-approvals', rescheduleApprovalsRoutes)
router.use('/payments/offline', offlinePaymentRoutes)
router.use('/news', newsRoutes)

export default router
