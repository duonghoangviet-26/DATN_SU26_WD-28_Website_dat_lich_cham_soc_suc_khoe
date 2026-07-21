import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import axiosInstance from '@/services/axiosInstance'
import { nurseService } from '@/services/nurse.service'

const mockedGet = vi.mocked(axiosInstance.get)
const mockedPost = vi.mocked(axiosInstance.post)
const mockedPatch = vi.mocked(axiosInstance.patch)

describe('nurseService (PROMPT 30 — mapping & filter)', () => {
  beforeEach(() => {
    mockedGet.mockReset(); mockedPost.mockReset(); mockedPatch.mockReset()
  })

  it('getQueue() gọi đúng endpoint, CHỈ gửi tham số có giá trị (bỏ status rỗng) và unwrap data.data', async () => {
    mockedGet.mockResolvedValue({
      data: { data: { items: [{ id: 'a1' }], total: 1, page: 1, limit: 20 } },
    } as never)

    const page = await nurseService.getQueue({ date: '2026-07-19', status: '', q: 'Bình', page: 1, limit: 20 })

    expect(mockedGet).toHaveBeenCalledWith('/nurse/appointments', {
      params: { date: '2026-07-19', q: 'Bình', page: '1', limit: '20' }, // status '' bị loại; page/limit là chuỗi
    })
    expect(page.total).toBe(1)
    expect(page.items[0].id).toBe('a1')
  })

  it('getQueue() không tham số -> params rỗng', async () => {
    mockedGet.mockResolvedValue({ data: { data: { items: [], total: 0, page: 1, limit: 20 } } } as never)
    await nurseService.getQueue()
    expect(mockedGet).toHaveBeenCalledWith('/nurse/appointments', { params: {} })
  })

  it('getPendingRecords() gọi đúng endpoint pending-records với date', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'p1', giai_doan: 'ban_nhap' }] } } as never)
    const list = await nurseService.getPendingRecords({ date: '2026-07-19' })
    expect(mockedGet).toHaveBeenCalledWith('/nurse/appointments/pending-records', { params: { date: '2026-07-19' } })
    expect(list[0].giai_doan).toBe('ban_nhap')
  })

  it('getSchedule() gọi /nurse/schedule với from/to', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ ngay: '2026-07-19' }] } } as never)
    await nurseService.getSchedule({ from: '2026-07-15', to: '2026-07-21' })
    expect(mockedGet).toHaveBeenCalledWith('/nurse/schedule', { params: { from: '2026-07-15', to: '2026-07-21' } })
  })

  it('getAppointmentById() gọi đúng URL theo id', async () => {
    mockedGet.mockResolvedValue({ data: { data: { id: 'x1', status: 'confirmed' } } } as never)
    const d = await nurseService.getAppointmentById('x1')
    expect(mockedGet).toHaveBeenCalledWith('/nurse/appointments/x1')
    expect(d.status).toBe('confirmed')
  })

  it('createDraft() POST /nurse/medical-records với payload', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'r1', status: 'ban_nhap' } } } as never)
    const payload = { appointment_id: 'x1', chan_doan: 'Test' }
    const r = await nurseService.createDraft(payload as never)
    expect(mockedPost).toHaveBeenCalledWith('/nurse/medical-records', payload)
    expect(r.status).toBe('ban_nhap')
  })

  it('submit() PATCH /nurse/medical-records/:id/submit', async () => {
    mockedPatch.mockResolvedValue({ data: { data: { id: 'r1', status: 'cho_xac_nhan', appointment_status: 'waiting_doctor_confirm' } } } as never)
    const r = await nurseService.submit('r1')
    expect(mockedPatch).toHaveBeenCalledWith('/nurse/medical-records/r1/submit')
    expect(r.status).toBe('cho_xac_nhan')
  })

  it('resubmit() PATCH /nurse/medical-records/:id/resubmit', async () => {
    mockedPatch.mockResolvedValue({ data: { data: { id: 'r1', status: 'cho_xac_nhan', appointment_status: 'waiting_doctor_confirm' } } } as never)
    await nurseService.resubmit('r1')
    expect(mockedPatch).toHaveBeenCalledWith('/nurse/medical-records/r1/resubmit')
  })

  it('checkinQueue() POST /nurse/queue/checkin với payload', async () => {
    mockedPost.mockResolvedValue({ data: { data: { entry: { id: 'q1' } } } } as never)
    await nurseService.checkinQueue({ appointment_id: 'x1' } as never)
    expect(mockedPost).toHaveBeenCalledWith('/nurse/queue/checkin', { appointment_id: 'x1' })
  })
})
