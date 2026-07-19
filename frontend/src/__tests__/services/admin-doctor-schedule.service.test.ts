import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { adminDoctorScheduleService } from '@/services/admin-doctor-schedule.service'

const mockedGet = vi.mocked(axiosInstance.get)

describe('adminDoctorScheduleService', () => {
  beforeEach(() => mockedGet.mockReset())

  it('getWorkdays forwards the abort signal so stale calendar requests can be cancelled', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          doctor: { _id: 'doctor-1', ten: 'Bác sĩ Test' },
          range: { from: '2026-07-13', to: '2026-07-19' },
          items: [],
        },
      },
    } as never)

    const controller = new AbortController()
    await adminDoctorScheduleService.getWorkdays({
      doctor_id: 'doctor-1',
      from: '2026-07-13',
      to: '2026-07-19',
    }, controller.signal)

    expect(mockedGet).toHaveBeenCalledWith('/admin/slots/calendar', {
      params: {
        doctor_id: 'doctor-1',
        from: '2026-07-13',
        to: '2026-07-19',
      },
      signal: controller.signal,
    })
  })
})
