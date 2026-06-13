import type { PaymentItem, PaymentStatus } from '@/types'
import { mockPayments } from '@/mock/payments'
import { delay, findOrThrow } from '@/utils/format'

let payments: PaymentItem[] = [...mockPayments]

interface PaymentFilters {
  keyword?: string
  status?: PaymentStatus | ''
}

export const paymentService = {
  async getAll({ keyword = '', status = '' }: PaymentFilters = {}): Promise<PaymentItem[]> {
    await delay()
    let result = [...payments]
    if (keyword) {
      const kw = keyword.toLowerCase()
      result = result.filter(
        (p) =>
          p.benh_nhan.toLowerCase().includes(kw) ||
          p.bac_si.toLowerCase().includes(kw) ||
          p.ma_giao_dich.toLowerCase().includes(kw),
      )
    }
    if (status) result = result.filter((p) => p.status === status)
    return result
  },

  async refund(id: number): Promise<PaymentItem> {
    await delay(300)
    payments = payments.map((p) => p.id === id ? { ...p, status: 'refunded' } : p)
    return findOrThrow(payments, id, 'Giao dịch')
  },
}
