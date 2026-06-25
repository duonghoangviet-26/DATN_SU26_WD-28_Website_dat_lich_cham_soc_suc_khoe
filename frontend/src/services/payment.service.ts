import { mockPayments } from '@/mock/payments'
import type { PaymentItem } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let payments = [...mockPayments]

interface PaymentFilters {
  keyword?: string
  status?: string
  from?: string
  to?: string
}

export const paymentService = {
  async getAll({ keyword = '', status = '', from = '', to = '' }: PaymentFilters = {}): Promise<PaymentItem[]> {
    await delay()
    let list = [...payments]
    if (keyword) {
      const q = keyword.toLowerCase()
      list = list.filter(p =>
        p.benh_nhan.toLowerCase().includes(q) ||
        p.bac_si.toLowerCase().includes(q) ||
        p.ma_giao_dich.toLowerCase().includes(q),
      )
    }
    if (status) list = list.filter(p => p.status === status)
    if (from)   list = list.filter(p => p.ngay_tao >= from)
    if (to)     list = list.filter(p => p.ngay_tao <= to)
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (keyword) params.search = keyword
    // if (status)  params.status = status
    // if (from)    params.from   = from
    // if (to)      params.to     = to
    // const res = await axiosInstance.get<ApiResponse<PaymentItem[]>>('/admin/payments', { params })
    // return res.data.data
  },

  async getById(id: string): Promise<PaymentItem> {
    await delay()
    const item = payments.find(p => String(p.id) === String(id))
    if (!item) throw new Error('Không tìm thấy giao dịch')
    return { ...item }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<PaymentItem>>(`/admin/payments/${id}`)
    // return res.data.data
  },

  async refund(id: string): Promise<PaymentItem> {
    await delay()
    const item = payments.find(p => String(p.id) === String(id))
    if (!item) throw new Error('Không tìm thấy giao dịch')
    item.status = 'refunded'
    return { ...item }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<PaymentItem>>(`/admin/payments/${id}/refund`)
    // return res.data.data
  },
}
