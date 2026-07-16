import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { doctorLeaveService } from '@/services/doctor-leave.service'

const mockedGet = vi.mocked(axiosInstance.get)
const mockedPost = vi.mocked(axiosInstance.post)
const mockedPatch = vi.mocked(axiosInstance.patch)

describe('doctorLeaveService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedPatch.mockReset()
  })

  it('list() calls real endpoint and returns ghi_chu from Admin (Prompt 2)', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: 'leave-1', tu_ngay: '2026-07-20', den_ngay: '2026-07-20', ly_do: 'Việc gia đình', trang_thai: 'da_duyet', ghi_chu: 'Đã sắp xếp bác sĩ trực thay' },
        ],
      },
    } as never)

    const list = await doctorLeaveService.list()

    expect(mockedGet).toHaveBeenCalledWith('/doctor/leaves')
    expect(list[0].ghi_chu).toBe('Đã sắp xếp bác sĩ trực thay')
  })

  it('create() posts to real endpoint and surfaces so_lich_hen_anh_huong', async () => {
    mockedPost.mockResolvedValue({
      data: {
        data: {
          id: 'leave-2', tu_ngay: '2026-07-21', den_ngay: '2026-07-21',
          gio_bat_dau: '08:00', gio_ket_thuc: '08:30',
          ly_do: 'Bận đột xuất', trang_thai: 'cho_duyet', so_lich_hen_anh_huong: 2,
        },
      },
    } as never)

    const created = await doctorLeaveService.create('2026-07-21', '2026-07-21', 'Bận đột xuất', '08:00', '08:30')

    expect(mockedPost).toHaveBeenCalledWith('/doctor/leaves', {
      tu_ngay: '2026-07-21', den_ngay: '2026-07-21', ly_do: 'Bận đột xuất',
      gio_bat_dau: '08:00', gio_ket_thuc: '08:30',
    })
    expect(created.so_lich_hen_anh_huong).toBe(2)
  })

  it('cancel() patches the real cancel endpoint for the given id only', async () => {
    mockedPatch.mockResolvedValue({
      data: { data: { id: 'leave-3', tu_ngay: '2026-07-22', den_ngay: '2026-07-22', ly_do: null, trang_thai: 'da_huy' } },
    } as never)

    const updated = await doctorLeaveService.cancel('leave-3')

    expect(mockedPatch).toHaveBeenCalledWith('/doctor/leaves/leave-3/cancel')
    expect(updated.trang_thai).toBe('da_huy')
  })
})
