import { Router } from 'express'
import appointmentController from '../../controllers/receptionist/appointment.controller.js'

const router = Router()

router.get('/', appointmentController.getAppointments)
// Phải đứng TRƯỚC '/:id/...' — nếu không 'pending-checkin' sẽ khớp vào ':id'.
router.get('/pending-checkin', appointmentController.getPendingCheckin)
router.patch('/:id/arrived', appointmentController.markAsArrived)
router.patch('/:id/reschedule', appointmentController.rescheduleAppointment)
router.get('/:id/reschedule-history', appointmentController.getRescheduleHistory)
router.patch('/:id/cancel', appointmentController.cancelAppointment)

export default router
