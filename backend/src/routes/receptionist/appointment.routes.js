import { Router } from 'express'
import appointmentController from '../../controllers/receptionist/appointment.controller.js'

const router = Router()

router.get('/', appointmentController.getAppointments)
router.patch('/:id/arrived', appointmentController.markAsArrived)
router.patch('/:id/reschedule', appointmentController.rescheduleAppointment)
router.patch('/:id/cancel', appointmentController.cancelAppointment)

export default router
