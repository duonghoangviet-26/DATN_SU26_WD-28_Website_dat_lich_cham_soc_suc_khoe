import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { scheduleService } from '@/services/schedule.service'
import type { DoctorSlot } from '@/types'

const mockedGet = vi.mocked(axiosInstance.get)
const mockedPost = vi.mocked(axiosInstance.post)

describe('scheduleService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('getAll() calls the real doctor schedule endpoint with from/to and forwards abort signal', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'slot-1', schedule_id: 'sched-1', ngay: '2026-07-20',
            gio_bat_dau: '08:00', gio_ket_thuc: '08:30',
            status: 'active', nurse: 'Điều dưỡng Thanh Hà', nurse_id: 'nurse-1',
            trang_thai_ngay: 'lam_viec',
          },
        ],
      },
    } as never)

    const controller = new AbortController()
    const list = await scheduleService.getAll({ from: '2026-07-20', to: '2026-07-25' }, controller.signal)

    expect(mockedGet).toHaveBeenCalledWith('/doctor/schedule', {
      params: { from: '2026-07-20', to: '2026-07-25' },
      signal: controller.signal,
    })
    expect(list[0].nurse).toBe('Điều dưỡng Thanh Hà')
    expect(list[0].trang_thai_ngay).toBe('lam_viec')
  })

  it('getDetail() calls the real chi-tiết-ca endpoint (Prompt 2) with the given scheduleId', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          id: 'sched-1', ngay: '2026-07-20', trang_thai_ngay: 'lam_viec',
          ghi_chu_ngay: null, chi_nhanh_id: null, nurse_id: null, nurse: null,
          slots: [], lich_hen: [],
          thong_ke: {
            tong_slot: 0, slot_trong: 0, slot_da_dat: 0, slot_bi_khoa: 0, slot_da_huy: 0,
            tong_lich_hen: 0, cho_kham: 0, da_den: 0, dang_kham: 0, cho_xac_nhan_ho_so: 0,
            cho_tiep_nhan: 0, hoan_thanh: 0, khong_den: 0, da_huy: 0, khac: 0, so_lich_hen_con_hieu_luc: 0,
          },
        },
      },
    } as never)

    const detail = await scheduleService.getDetail('sched-1')

    expect(mockedGet).toHaveBeenCalledWith('/doctor/schedule/sched-1', { signal: undefined })
    expect(detail.id).toBe('sched-1')
    expect(detail.thong_ke.tong_slot).toBe(0)
  })

  it('requestCancelSlot() posts to the request-cancel endpoint with ly_do, does not send doctor identity', async () => {
    mockedPost.mockResolvedValue({ data: { success: true } } as never)

    const slot: DoctorSlot = {
      id: 'slot-1', schedule_id: 'sched-1', ngay: '2026-07-20',
      gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'booked',
    }
    await scheduleService.requestCancelSlot(slot, 'Bác sĩ có việc đột xuất')

    expect(mockedPost).toHaveBeenCalledWith(
      '/doctor/schedule/sched-1/slots/slot-1/request-cancel',
      { ly_do: 'Bác sĩ có việc đột xuất' },
    )
  })
})
