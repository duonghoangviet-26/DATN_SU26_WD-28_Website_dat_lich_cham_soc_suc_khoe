import { Router } from 'express'
import * as bookingController from '../../controllers/receptionist/booking.controller.js'

const router = Router()

router.get('/specialties', bookingController.getSpecialties)
router.get('/services', bookingController.getServices)
router.get('/doctors', bookingController.getDoctors)
router.get('/doctors/:id', bookingController.getDoctorById)
router.get('/doctors/:id/slots', bookingController.getSlots)
// Tra cứu mức độ còn trống cho khách gọi điện — KHÔNG giữ chỗ (rule mục 13).
router.get('/availability', bookingController.getAvailability)

router.post('/', bookingController.createBooking)

export default router
