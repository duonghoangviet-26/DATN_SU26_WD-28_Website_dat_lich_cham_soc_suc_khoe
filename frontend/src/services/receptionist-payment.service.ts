import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse, PaymentItem, TransactionStatus } from '@/types'

export interface PaymentFilters {
  keyword?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PaymentPagination {
  total: number
  totalPages: number
  page: number
  limit: number
}

export interface PaymentSummary {
  paidAmount: number
  pendingCount: number
}

export interface PaymentListResponse {
  data: PaymentItem[]
  pagination: PaymentPagination
  summary: PaymentSummary
}

function mapPaymentItem(item: Partial<PaymentItem> & { id?: string | number; _id?: string | number }): PaymentItem {
  return {
    id: item.id ?? item._id ?? '',
    ma_giao_dich: item.ma_giao_dich ?? '',
    benh_nhan: item.benh_nhan ?? 'Không rõ',
    bac_si: item.bac_si ?? 'Không rõ',
    nguoi_thanh_toan: item.nguoi_thanh_toan ?? 'Không rõ',
    so_tien: Number(item.so_tien ?? 0),
    phuong_thuc: item.phuong_thuc ?? 'chuyen_khoan',
    status: (item.status as TransactionStatus) ?? 'pending',
    ngay_tao: item.ngay_tao ?? '',
    hoa_don_id: item.hoa_don_id ?? null,
    appointment_id: item.appointment_id ?? null,
    so_hoa_don: item.so_hoa_don ?? null,
    loai_thanh_toan: item.loai_thanh_toan ?? null,
    email: item.email ?? null,
    so_dien_thoai: item.so_dien_thoai ?? null,
    nguoi_thu_id: item.nguoi_thu_id ?? null,
    thoi_diem_thanh_toan: item.thoi_diem_thanh_toan ?? null,
    ngay_thanh_toan: item.ngay_thanh_toan ?? null,
    trang_thai_hoa_don: item.trang_thai_hoa_don ?? null,
  }
}

export const receptionistPaymentService = {
  async getAll(
    { keyword = '', status = '', from = '', to = '', page = 1, limit = 8 }: PaymentFilters = {},
    signal?: AbortSignal,
  ): Promise<PaymentListResponse> {
    const params: Record<string, string | number> = { page, limit }
    if (keyword) params.search = keyword
    if (status) params.status = status
    if (from) params.from = from
    if (to) params.to = to

    const res = await axiosInstance.get<ApiResponse<PaymentItem[]> & {
      pagination?: PaymentPagination
      summary?: Partial<PaymentSummary>
    }>('/receptionist/payments', { params, signal })
    
    const items = (Array.isArray(res.data.data) ? res.data.data : []).map(mapPaymentItem)
    const pagination = res.data.pagination ?? {
      total: items.length,
      totalPages: 1,
      page,
      limit,
    }

    return {
      data: items,
      pagination,
      summary: {
        paidAmount: Number(res.data.summary?.paidAmount ?? items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.so_tien, 0)),
        pendingCount: Number(res.data.summary?.pendingCount ?? items.filter((item) => item.status === 'pending').length),
      },
    }
  },

  async confirmCashPayment(id: string | number): Promise<ApiResponse<PaymentItem>> {
    const res = await axiosInstance.patch<ApiResponse<PaymentItem>>(`/receptionist/payments/${id}/confirm-cash`)
    return res.data
  }
}
