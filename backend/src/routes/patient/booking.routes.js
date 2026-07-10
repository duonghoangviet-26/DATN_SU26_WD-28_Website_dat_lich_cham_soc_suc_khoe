import { Router } from 'express'
import * as booking from '../../controllers/patient/booking.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/specialties',              booking.getSpecialties)
router.get('/services',                 booking.getServices)
router.get('/doctors',                  booking.getDoctors)
router.get('/doctors/:id',              booking.getDoctorById)
router.get('/doctors/:id/slots',        booking.getSlots)
router.post('/',                        verifyToken, requireRole('user'), booking.createBooking)
router.patch('/:id/cancel',             verifyToken, requireRole('user'), booking.cancelBooking)

export default router
