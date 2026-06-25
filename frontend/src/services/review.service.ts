import { mockReviews } from '@/mock/reviews'
import type { ReviewItem } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let reviews = [...mockReviews]

interface ReviewFilters {
  status?: string
  search?: string
}

export const reviewService = {
  async getAll({ status = '', search = '' }: ReviewFilters = {}): Promise<ReviewItem[]> {
    await delay()
    let list = [...reviews]
    if (status) list = list.filter(r => r.status === status)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.benh_nhan.toLowerCase().includes(q) ||
        r.bac_si.toLowerCase().includes(q) ||
        r.noi_dung.toLowerCase().includes(q),
      )
    }
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (status) params.status = status
    // if (search) params.search = search
    // const res = await axiosInstance.get<ApiResponse<ReviewItem[]>>('/admin/reviews', { params })
    // return res.data.data
  },

  async toggle(id: string): Promise<{ id: string; status: string }> {
    await delay()
    const review = reviews.find(r => String(r.id) === String(id))
    if (review) review.status = review.status === 'visible' ? 'hidden' : 'visible'
    return { id, status: review?.status ?? 'visible' }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string }>>(`/admin/reviews/${id}/toggle`)
    // return res.data.data
  },
}
