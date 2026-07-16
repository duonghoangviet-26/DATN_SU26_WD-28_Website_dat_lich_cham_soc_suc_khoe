import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'

const mockedPatch = vi.mocked(axiosInstance.patch)

describe('doctorAppointmentService.confirmResult', () => {
  beforeEach(() => {
    mockedPatch.mockReset()
  })

  it('gửi kèm body chỉnh sửa khi bác sĩ "Lưu & Xác nhận"', async () => {
    mockedPatch.mockResolvedValue({
      data: { data: { id: 'r1', status: 'da_xac_nhan', appointment_status: 'completed' } },
    } as never)

    const payload = {
      chan_doan: 'Viêm họng',
      huong_dan_dieu_tri: 'Nghỉ ngơi',
      ghi_chu: null,
      ngay_tai_kham: '2026-08-10',
      thuoc: [{ ten_thuoc: 'Amoxicillin', lieu_luong: '500mg', tan_suat: '2 lần/ngày', gio_uong: ['08:00'], so_ngay: 7, ghi_chu: null }],
    }
    const res = await doctorAppointmentService.confirmResult('apt-1', payload)

    expect(mockedPatch).toHaveBeenCalledWith('/doctor/appointments/apt-1/result/confirm', payload)
    expect(res.status).toBe('da_xac_nhan')
    expect(res.appointment_status).toBe('completed')
  })

  it('xác nhận không kèm sửa vẫn gọi đúng endpoint', async () => {
    mockedPatch.mockResolvedValue({
      data: { data: { id: 'r1', status: 'da_xac_nhan', appointment_status: 'completed' } },
    } as never)

    await doctorAppointmentService.confirmResult('apt-1')

    expect(mockedPatch).toHaveBeenCalledWith('/doctor/appointments/apt-1/result/confirm', undefined)
  })
})
