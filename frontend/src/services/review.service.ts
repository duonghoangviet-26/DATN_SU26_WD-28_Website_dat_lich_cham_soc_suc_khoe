import type { ReviewItem } from '@/types'
import { mockReviews } from '@/mock/reviews'
import { delay, findOrThrow } from '@/utils/format'

let reviews: ReviewItem[] = [...mockReviews]

interface ReviewFilters {
  diem?: string
  status?: string
}

export const reviewService = {
  async getAll({ diem = '', status = '' }: ReviewFilters = {}): Promise<ReviewItem[]> {
    await delay()
    let result = [...reviews]
    if (diem) result = result.filter((r) => r.diem === Number(diem))
    if (status) result = result.filter((r) => r.status === status)
    return result
  },

  async toggle(id: number): Promise<ReviewItem> {
    await delay(200)
    reviews = reviews.map((r) =>
      r.id === id ? { ...r, status: r.status === 'visible' ? 'hidden' : 'visible' } : r,
    )
    return findOrThrow(reviews, id, 'Đánh giá')
  },
}
