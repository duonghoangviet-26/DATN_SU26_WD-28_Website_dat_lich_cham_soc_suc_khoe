import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'
import type { 
  ReviewItem, 
  ReviewFilters, 
  ReviewListResponse, 
  ReviewDetailResponse 
} from '@/types/review.type'

export const reviewService = {
  /**
   * Lấy danh sách đánh giá kèm phân trang, bộ lọc & thống kê.
   * GET /api/admin/reviews
   */
  async getAll(params: Partial<ReviewFilters> & { page?: number; limit?: number }): Promise<ReviewListResponse> {
    const queryParams: Record<string, any> = {}
    if (params.page) queryParams.page = params.page
    if (params.limit) queryParams.limit = params.limit
    if (params.rating) queryParams.rating = params.rating
    if (params.status) queryParams.status = params.status
    if (params.doctor) queryParams.doctor = params.doctor
    if (params.startDate) queryParams.startDate = params.startDate
    if (params.endDate) queryParams.endDate = params.endDate
    if (params.search?.trim()) queryParams.search = params.search.trim()
    if (params.deleted !== undefined) queryParams.deleted = params.deleted.toString()
    
    // Thêm timestamp để chống trình duyệt cache kết quả GET
    queryParams._t = Date.now()

    const res = await axiosInstance.get<ApiResponse<ReviewListResponse>>('/admin/reviews', { params: queryParams })
    return res.data.data
  },

  /**
   * Lấy chi tiết 1 đánh giá kèm lịch sử thao tác.
   * GET /api/admin/reviews/:id
   */
  async getById(id: string): Promise<ReviewDetailResponse> {
    const res = await axiosInstance.get<ApiResponse<ReviewDetailResponse>>(`/admin/reviews/${id}`)
    return res.data.data
  },

  /**
   * Ẩn đánh giá.
   * PATCH /api/admin/reviews/:id/hide
   */
  async hide(id: string, ly_do?: string): Promise<ReviewItem> {
    const res = await axiosInstance.patch<ApiResponse<ReviewItem>>(`/admin/reviews/${id}/hide`, { ly_do })
    return res.data.data
  },

  /**
   * Hiện lại đánh giá.
   * PATCH /api/admin/reviews/:id/show
   */
  async show(id: string, ly_do?: string): Promise<ReviewItem> {
    const res = await axiosInstance.patch<ApiResponse<ReviewItem>>(`/admin/reviews/${id}/show`, { ly_do })
    return res.data.data
  },

  /**
   * Xóa mềm đánh giá.
   * PATCH /api/admin/reviews/:id/delete
   */
  async softDelete(id: string, ly_do?: string): Promise<void> {
    await axiosInstance.patch<ApiResponse<null>>(`/admin/reviews/${id}/delete`, { ly_do })
  },

  /**
   * Khôi phục đánh giá bị xóa mềm.
   * PATCH /api/admin/reviews/:id/restore
   */
  async restore(id: string, ly_do?: string): Promise<ReviewItem> {
    const res = await axiosInstance.patch<ApiResponse<ReviewItem>>(`/admin/reviews/${id}/restore`, { ly_do })
    return res.data.data
  },

  /**
   * Xóa cứng đánh giá (Xóa vĩnh viễn khỏi DB).
   * DELETE /api/admin/reviews/:id/permanently
   */
  async hardDelete(id: string): Promise<void> {
    await axiosInstance.delete<ApiResponse<null>>(`/admin/reviews/${id}/permanently`)
  },

  /**
   * Lấy danh sách bác sĩ cho dropdown lọc.
   * GET /api/admin/reviews/doctors
   */
  async getDoctors(): Promise<Array<{ id: string; ho_ten: string }>> {
    const res = await axiosInstance.get<ApiResponse<Array<{ id: string; ho_ten: string }>>>('/admin/reviews/doctors', {
      params: { _t: Date.now() }
    })
    return res.data.data
  },
}
