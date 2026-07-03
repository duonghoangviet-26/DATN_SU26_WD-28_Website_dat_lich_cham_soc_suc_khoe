export interface ReviewUser {
  id: string
  ho_ten: string
  email: string
  anh_dai_dien: string | null
}

export interface ReviewDoctor {
  id: string
  ho_ten: string | null
  email: string | null
}

export interface ReviewItem {
  id: string
  appointment_id: string
  user: ReviewUser | null
  doctor: ReviewDoctor | null
  so_sao: number
  noi_dung: string | null
  status: 'visible' | 'hidden'
  ngay_tao: string
  ngay_xoa: string | null
}

export interface ReviewHistoryLog {
  id: string
  nguoi_thuc_hien: {
    id: string
    ho_ten: string
    email: string
    role: string
  } | null
  vai_tro: string
  hanh_dong: string
  ly_do: string | null
  ngay_tao: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ReviewStatistics {
  averageRating: number
  total: number
  visible: number
  hidden: number
}

export interface ReviewListResponse {
  reviews: ReviewItem[]
  pagination: PaginationInfo
  statistics: ReviewStatistics
}

export interface ReviewDetailResponse {
  review: ReviewItem
  history: ReviewHistoryLog[]
}

export interface ReviewFilters {
  search: string
  rating: string
  status: string
  doctor: string
  startDate: string
  endDate: string
  deleted: boolean
}
