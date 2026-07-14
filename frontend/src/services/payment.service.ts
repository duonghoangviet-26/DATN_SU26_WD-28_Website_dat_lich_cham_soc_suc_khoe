import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse, PaymentItem, TransactionStatus } from '@/types'

interface PaymentFilters {
  keyword?: string
  status?: string
  from?: string
  to?: string
}

function mapPaymentItem(item: Partial<PaymentItem> & { id?: string | number; _id?: string | number }): PaymentItem {
  return {
    id: item.id ?? item._id ?? '',
    ma_giao_dich: item.ma_giao_dich ?? '',
    benh_nhan: item.benh_nhan ?? 'Không rõ',
    bac_si: item.bac_si ?? 'Không rõ',
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

export const paymentService = {
  async getAll({ keyword = '', status = '', from = '', to = '' }: PaymentFilters = {}): Promise<PaymentItem[]> {
    const params: Record<string, string> = {}
    if (keyword) params.search = keyword
    if (status) params.status = status
    if (from) params.from = from
    if (to) params.to = to

    const res = await axiosInstance.get<ApiResponse<PaymentItem[]>>('/admin/payments', { params })
    return (Array.isArray(res.data.data) ? res.data.data : []).map(mapPaymentItem)
  },

  async getById(id: string | number): Promise<PaymentItem> {
    const res = await axiosInstance.get<ApiResponse<PaymentItem>>(`/admin/payments/${id}`)
    return mapPaymentItem(res.data.data ?? {})
  },

  async refund(id: string | number): Promise<PaymentItem> {
    await axiosInstance.patch<ApiResponse<{ id: string | number; status: TransactionStatus }>>(`/admin/payments/${id}/refund`)
    return this.getById(id)
  },
}
