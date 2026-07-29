import { Router } from 'express'
import * as booking from '../../controllers/patient/booking.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/specialties',              booking.getSpecialties)
// Luồng MẶC ĐỊNH (rule mục 12): chọn chuyên khoa + khung giờ, hệ thống tự gán bác sĩ.
// Trả kèm giá vì giá phải hiển thị TRƯỚC khi giữ chỗ.
router.get('/specialties/:id/slots',    booking.getSpecialtySlots)
router.get('/services',                 booking.getServices)
router.get('/doctors',                  booking.getDoctors)
router.get('/doctors/:id',              booking.getDoctorById)
router.get('/doctors/:id/slots',        booking.getSlots)
router.get('/doctors/:id/reviews',      booking.getDoctorReviews)
router.post('/doctors/:id/reviews',     verifyToken, requireRole('user', 'patient'), booking.createDoctorReview)
router.post('/',                        verifyToken, requireRole('user', 'patient'), booking.createBooking)
router.patch('/:id/cancel',             verifyToken, requireRole('user', 'patient'), booking.cancelBooking)

export default router
