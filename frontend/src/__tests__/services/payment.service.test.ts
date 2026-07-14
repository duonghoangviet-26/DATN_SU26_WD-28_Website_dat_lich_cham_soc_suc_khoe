import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { paymentService } from '@/services/payment.service'

const mockedGet = vi.mocked(axiosInstance.get)
const mockedPatch = vi.mocked(axiosInstance.patch)

describe('paymentService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPatch.mockReset()
  })

  it('getAll() calls real admin payments API with mapped filters', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'pay-1',
            ma_giao_dich: 'TXN0001',
            benh_nhan: 'Nguyen Van A',
            bac_si: 'BS. Tran B',
            so_tien: 300000,
            phuong_thuc: 'chuyen_khoan',
            status: 'paid',
            ngay_tao: '2026-07-07T08:00:00.000Z',
          },
        ],
      },
    } as never)

    const list = await paymentService.getAll({ keyword: 'TXN', status: 'paid', from: '2026-07-01', to: '2026-07-31' })

    expect(mockedGet).toHaveBeenCalledWith('/admin/payments', {
      params: {
        search: 'TXN',
        status: 'paid',
        from: '2026-07-01',
        to: '2026-07-31',
      },
    })
    expect(list[0].phuong_thuc).toBe('chuyen_khoan')
  })

  it('getById() reads a payment from real API', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          id: 'pay-2',
          ma_giao_dich: 'TXN0002',
          benh_nhan: 'Pham Thi C',
          bac_si: 'BS. Le D',
          so_tien: 450000,
          phuong_thuc: 'vi_dien_tu',
          status: 'pending',
          ngay_tao: '2026-07-07T09:00:00.000Z',
        },
      },
    } as never)

    const item = await paymentService.getById('pay-2')

    expect(mockedGet).toHaveBeenCalledWith('/admin/payments/pay-2')
    expect(item.id).toBe('pay-2')
    expect(item.status).toBe('pending')
  })

  it('refund() calls refund endpoint then reloads payment detail', async () => {
    mockedPatch.mockResolvedValue({ data: { data: { id: 'pay-3', status: 'refunded' } } } as never)
    mockedGet.mockResolvedValue({
      data: {
        data: {
          id: 'pay-3',
          ma_giao_dich: 'TXN0003',
          benh_nhan: 'Tran Thi E',
          bac_si: 'BS. Nguyen F',
          so_tien: 500000,
          phuong_thuc: 'tien_mat',
          status: 'refunded',
          ngay_tao: '2026-07-07T10:00:00.000Z',
        },
      },
    } as never)

    const item = await paymentService.refund('pay-3')

    expect(mockedPatch).toHaveBeenCalledWith('/admin/payments/pay-3/refund')
    expect(mockedGet).toHaveBeenCalledWith('/admin/payments/pay-3')
    expect(item.status).toBe('refunded')
  })
})
