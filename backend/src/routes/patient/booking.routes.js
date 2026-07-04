import { Router } from 'express'
import * as booking from '../../controllers/patient/booking.controller.js'

const router = Router()

router.get('/specialties',              booking.getSpecialties)
router.get('/services',                 booking.getServices)
router.get('/doctors',                  booking.getDoctors)
router.get('/doctors/:id',              booking.getDoctorById)
router.get('/doctors/:id/slots',        booking.getSlots)
router.post('/',                        booking.createBooking)
router.patch('/:id/cancel',             booking.cancelBooking)

export default router
