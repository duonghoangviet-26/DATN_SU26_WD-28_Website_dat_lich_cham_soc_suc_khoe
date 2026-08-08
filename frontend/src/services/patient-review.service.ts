import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PendingReviewAppointment {
  appointment_id: string
  ma_lich_hen: string
  ngay_kham: string
  gio_kham: string
  gio_ket_thuc: string | null
  phong_kham: string | null
  doctor: {
    id: string
    ho_ten: string
    anh_dai_dien: string | null
  } | null
  specialty: {
    id: string
    ten: string
  } | null
}

export interface MyReviewItem {
  id: string
  so_sao: number
  chi_tiet?: {
    danh_gia_le_tan: number
    danh_gia_bac_si: number
    danh_gia_dich_vu: number
  }
  noi_dung: string | null
  status: 'visible' | 'hidden'
  ngay_tao: string
  appointment: {
    ma_lich_hen: string
    ngay_kham: string
    gio_kham: string
    gio_ket_thuc: string | null
    phong_kham: string | null
    specialty: { ten: string } | null
  } | null
  doctor: {
    id: string
    ho_ten: string
    anh_dai_dien: string | null
  } | null
}

export interface MyReviewsResponse {
  reviews: MyReviewItem[]
  total: number
  page: number
  totalPages: number
}

// ── Service ──────────────────────────────────────────────────────────────────

export const patientReviewService = {
  /** Lấy danh sách lịch hẹn chờ đánh giá */
  async getPending(): Promise<PendingReviewAppointment[]> {
    const res = await axiosInstance.get<ApiResponse<PendingReviewAppointment[]>>(
      '/patient/reviews/pending'
    )
    return res.data.data
  },

  /** Lấy danh sách đánh giá đã gửi (phân trang) */
  async getMy(page = 1, limit = 10): Promise<MyReviewsResponse> {
    const res = await axiosInstance.get<ApiResponse<MyReviewsResponse>>(
      '/patient/reviews/my',
      { params: { page, limit } }
    )
    return res.data.data
  },

  /** Tạo đánh giá mới (hỗ trợ đa tiêu chí) */
  async create(data: {
    appointment_id: string
    so_sao?: number
    danh_gia_le_tan?: number
    danh_gia_bac_si?: number
    danh_gia_dich_vu?: number
    noi_dung?: string
  }): Promise<{
    id: string
    so_sao: number
    chi_tiet?: { danh_gia_le_tan: number; danh_gia_bac_si: number; danh_gia_dich_vu: number }
    noi_dung: string | null
    ngay_tao: string
  }> {
    const res = await axiosInstance.post<
      ApiResponse<{
        id: string
        so_sao: number
        chi_tiet?: { danh_gia_le_tan: number; danh_gia_bac_si: number; danh_gia_dich_vu: number }
        noi_dung: string | null
        ngay_tao: string
      }>
    >('/patient/reviews', data)
    return res.data.data
  },
}
