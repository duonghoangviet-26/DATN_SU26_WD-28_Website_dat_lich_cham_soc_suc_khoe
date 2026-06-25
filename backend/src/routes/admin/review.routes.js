import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as reviews from '../../controllers/admin/review.controller.js'

const router = Router()

// Tất cả route yêu cầu: đăng nhập + role admin
router.use(verifyToken, requireRole('admin'))

// Lấy danh sách đánh giá
router.get('/', reviews.getReviews)

// Lấy chi tiết đánh giá & lịch sử
router.get('/:id', reviews.getReviewDetail)

export default router
