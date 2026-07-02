import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as reviews from '../../controllers/admin/review.controller.js'

const router = Router()

// Tất cả route yêu cầu: đăng nhập + role admin
router.use(verifyToken, requireRole('admin'))
router.get('/', reviews.getReviews)      // Lấy danh sách đánh giá
router.post('/batch', reviews.batchAction) // Thao tác hàng loạt
router.get('/:id', reviews.getReviewDetail) // Lấy chi tiết đánh giá
router.patch('/:id/hide', reviews.hideReview)   // Ẩn đánh giá
router.patch('/:id/show', reviews.showReview)   // Hiện lại đánh giá
router.patch('/:id/delete', reviews.softDeleteReview)    // Xóa mềm đánh giá
router.patch('/:id/restore', reviews.restoreReview)     // Khôi phục đánh giá
router.delete('/:id/permanently', reviews.hardDeleteReview) // Xóa vĩnh viễn đánh giá

export default router
