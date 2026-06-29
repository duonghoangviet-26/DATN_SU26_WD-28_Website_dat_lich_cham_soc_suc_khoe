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

/**
 * Ẩn đánh giá
 */
export async function hideReview(req, res) {
  try {
    const { id } = req.params
    const { ly_do } = req.body
    const adminId = req.user.id

    const data = await reviewService.hideReview(id, adminId, ly_do)
    return ok(res, data, 'Ẩn đánh giá thành công')
  } catch (err) {
    const status = err.message.includes('không tồn tại') ? 404 : 400
    return fail(res, status, err.message)
  }
}

/**
 * Hiện đánh giá
 */
export async function showReview(req, res) {
  try {
    const { id } = req.params
    const { ly_do } = req.body
    const adminId = req.user.id

    const data = await reviewService.showReview(id, adminId, ly_do)
    return ok(res, data, 'Hiển thị đánh giá thành công')
  } catch (err) {
    const status = err.message.includes('không tồn tại') ? 404 : 400
    return fail(res, status, err.message)
  }
}

/**
 * Xóa mềm đánh giá
 */
export async function softDeleteReview(req, res) {
  try {
    const { id } = req.params
    const { ly_do } = req.body
    const adminId = req.user.id

    await reviewService.softDeleteReview(id, adminId, ly_do)
    return ok(res, null, 'Xóa mềm đánh giá thành công')
  } catch (err) {
    const status = err.message.includes('không tồn tại') ? 404 : 400
    return fail(res, status, err.message)
  }
}

/**
 * Khôi phục đánh giá
 */
export async function restoreReview(req, res) {
  try {
    const { id } = req.params
    const { ly_do } = req.body
    const adminId = req.user.id

    const data = await reviewService.restoreReview(id, adminId, ly_do)
    return ok(res, data, 'Khôi phục đánh giá thành công')
  } catch (err) {
    const status = err.message.includes('Không tìm thấy') ? 404 : 400
    return fail(res, status, err.message)
  }
}

/**
 * Xóa vĩnh viễn đánh giá (xóa cứng)
 */
export async function hardDeleteReview(req, res) {
  try {
    const { id } = req.params
    const adminId = req.user.id

    await reviewService.hardDeleteReview(id, adminId)
    return ok(res, null, 'Xóa vĩnh viễn đánh giá thành công')
  } catch (err) {
    const status = err.message.includes('trạng thái xóa mềm') ? 400 : 500
    return fail(res, status, err.message)
  }
}

/**
 * Thao tác hàng loạt trên nhiều đánh giá
 */
export async function batchAction(req, res) {
  try {
    const { ids, action, ly_do } = req.body
    const adminId = req.user.id
    
    const result = await reviewService.batchActionReviews(ids, action, adminId, ly_do)
    return ok(res, result, `Thực hiện thao tác hàng loạt thành công (${result.count} đánh giá)`)
  } catch (err) {
    return fail(res, 400, err.message)
  }
}
