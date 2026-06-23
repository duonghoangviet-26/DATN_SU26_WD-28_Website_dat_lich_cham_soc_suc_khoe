import { Router } from 'express'
import * as controller from '../controllers/appointment.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Chỉ Admin mới được truy cập các API này
router.use(verifyToken, requireRole('admin'))

// APIs hỗ trợ Đặt lịch hộ khách (lấy danh sách bác sĩ và khung giờ trống)
router.get('/doctors/active', controller.getActiveDoctors)
router.get('/doctors/:id/schedules', controller.getDoctorSchedules)

// CRUD cơ bản của Lịch hẹn
router.get('/', controller.getAllAppointments)
router.post('/', controller.createAppointment)
router.get('/:id', controller.getAppointmentById)
router.patch('/:id/cancel', controller.cancelAppointment)
router.patch('/:id/reschedule', controller.rescheduleAppointment)

export default router
