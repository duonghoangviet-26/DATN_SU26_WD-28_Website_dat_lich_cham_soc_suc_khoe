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
