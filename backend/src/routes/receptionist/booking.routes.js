import { Router } from 'express'
import * as bookingController from '../../controllers/receptionist/booking.controller.js'

const router = Router()

router.get('/specialties', bookingController.getSpecialties)
router.get('/services', bookingController.getServices)
router.get('/doctors', bookingController.getDoctors)
router.get('/doctors/:id', bookingController.getDoctorById)
router.get('/doctors/:id/slots', bookingController.getSlots)

router.post('/', bookingController.createBooking)

export default router
