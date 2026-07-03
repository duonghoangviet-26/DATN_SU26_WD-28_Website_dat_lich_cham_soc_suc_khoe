import { Router } from 'express'
import * as controller from '../../controllers/admin/appointment.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

// Chi Admin moi duoc truy cap cac API nay
router.use(verifyToken, requireRole('admin'))

// APIs ho tro dat lich ho
router.get('/doctors/active', controller.getActiveDoctors)
router.get('/services/active', controller.getActiveServices)
router.get('/doctors/:id/schedules', controller.getDoctorSchedules)

// CRUD co ban cua lich hen
router.get('/', controller.getAllAppointments)
router.post('/', controller.createAppointment)
router.get('/:id', controller.getAppointmentById)
router.get('/:id/history', controller.getAppointmentHistory)
router.patch('/:id/cancel', controller.cancelAppointment)
router.patch('/:id/reschedule', controller.rescheduleAppointment)
router.patch('/:id/restore', controller.restoreAppointment)
router.delete('/:id', controller.deleteAppointment)

export default router
