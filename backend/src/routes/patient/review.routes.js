import { Router } from 'express'
import * as reviews from '../../controllers/patient/review.controller.js'

const router = Router()

// GET  /api/patient/reviews/pending  — Lịch hẹn chờ đánh giá
router.get('/pending', reviews.getPendingReviews)

// GET  /api/patient/reviews/my       — Đánh giá đã gửi (phân trang)
router.get('/my', reviews.getMyReviews)

// POST /api/patient/reviews          — Tạo đánh giá mới
router.post('/', reviews.createReview)

export default router
