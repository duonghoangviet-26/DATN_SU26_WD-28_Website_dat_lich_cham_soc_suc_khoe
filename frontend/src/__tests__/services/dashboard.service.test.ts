import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { dashboardService } from '@/services/dashboard.service'

const mockedGet = vi.mocked(axiosInstance.get)

describe('dashboardService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('getSummary() calls the real admin dashboard endpoint', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          appointments_today: 12,
          doctors_active: 7,
          revenue: {
            invoiced_total: 1200000,
            collected_total: 950000,
            outstanding_total: 250000,
          },
          generated_at: '2026-07-08T08:00:00.000Z',
        },
      },
    } as never)

    const summary = await dashboardService.getSummary()

    expect(mockedGet).toHaveBeenCalledWith('/admin/dashboard')
    expect(summary.appointments_today).toBe(12)
    expect(summary.revenue.collected_total).toBe(950000)
  })
})
