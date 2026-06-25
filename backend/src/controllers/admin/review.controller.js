import * as reviewService from '../../services/review.service.js'
import { ok, fail } from '../../utils/response.js'

/**
 * Lấy danh sách đánh giá
 */
export async function getReviews(req, res) {
  try {
    const data = await reviewService.getReviewsList(req.query)
    return ok(res, data, 'Lấy danh sách đánh giá thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

/**
 * Lấy chi tiết đánh giá & lịch sử
 */
export async function getReviewDetail(req, res) {
  try {
    const { id } = req.params
    const data = await reviewService.getReviewDetail(id)
    return ok(res, data, 'Lấy chi tiết đánh giá thành công')
  } catch (err) {
    const status = err.message === 'Không tìm thấy đánh giá' ? 404 : 500
    return fail(res, status, err.message)
  }
}
