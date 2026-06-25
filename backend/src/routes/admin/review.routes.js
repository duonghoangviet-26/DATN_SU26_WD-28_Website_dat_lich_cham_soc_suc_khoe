import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as reviews from '../../controllers/admin/review.controller.js'

const router = Router()

// Tất cả route yêu cầu: đăng nhập + role admin
router.use(verifyToken, requireRole('admin'))
router.get('/', reviews.getReviews)
router.get('/:id', reviews.getReviewDetail)
router.patch('/:id/hide', reviews.hideReview)
router.patch('/:id/show', reviews.showReview)
router.patch('/:id/delete', reviews.softDeleteReview)
router.patch('/:id/restore', reviews.restoreReview)
router.delete('/:id/permanently', reviews.hardDeleteReview)

export default router
