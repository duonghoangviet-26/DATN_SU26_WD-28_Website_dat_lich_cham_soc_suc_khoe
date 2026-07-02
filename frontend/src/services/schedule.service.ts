import { mockSlots } from '@/mock/doctor-schedule'
import type { DoctorSlot } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let slots = [...mockSlots]
let slotIdCounter = slots.length + 1

interface CreateSchedulePayload {
  ngay: string
  slots: { gio_bat_dau: string; gio_ket_thuc: string; phong_kham?: string }[]
}

export const scheduleService = {
  async getAll(params?: { from?: string; to?: string }): Promise<DoctorSlot[]> {
    await delay()
    let list = [...slots]
    if (params?.from) list = list.filter(s => s.ngay >= params.from!)
    if (params?.to)   list = list.filter(s => s.ngay <= params.to!)
    return list
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorSlot[]>>('/doctor/schedule', { params })
    // return res.data.data
  },

  async create(payload: CreateSchedulePayload): Promise<DoctorSlot[]> {
    await delay()
    const scheduleId = `sched-new-${Date.now()}`
    const newSlots: DoctorSlot[] = payload.slots.map(s => ({
      id: String(slotIdCounter++),
      schedule_id: scheduleId,
      ngay: payload.ngay,
      gio_bat_dau: s.gio_bat_dau,
      gio_ket_thuc: s.gio_ket_thuc,
      phong_kham: s.phong_kham ?? null,
      benh_nhan: null,
      benh_nhan_id: null,
      status: 'active' as const,
    }))
    slots = [...slots, ...newSlots]
    return newSlots
    // Real API:
    // const res = await axiosInstance.post<ApiResponse<DoctorSlot[]>>('/doctor/schedule', payload)
    // return res.data.data
  },

  async lockSlot(slot: DoctorSlot): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => x.id === slot.id)
    if (s) s.status = 'locked'
    return { ...slot, status: 'locked' }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${slot.schedule_id}/slots/${slot.id}`, { status: 'locked' })
    // return res.data.data
  },

  async unlockSlot(slot: DoctorSlot): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => x.id === slot.id)
    if (s) s.status = 'active'
    return { ...slot, status: 'active' }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${slot.schedule_id}/slots/${slot.id}`, { status: 'active' })
    // return res.data.data
  },

  async updatePhongKham(slot: DoctorSlot, phong_kham: string | null): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => x.id === slot.id)
    if (s) s.phong_kham = phong_kham
    return { ...slot, phong_kham }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${slot.schedule_id}/slots/${slot.id}`, { phong_kham })
    // return res.data.data
  },

  async requestCancelSlot(slotId: string, ly_do: string): Promise<void> {
    await delay()
    // Cập nhật mảng slots gốc — nếu không, cờ cancel_requested bị mất khi trang gọi lại getAll()
    // (ví dụ đổi tab rồi quay lại) vì state cục bộ ở component không đồng bộ với "DB" mock này.
    const s = slots.find(x => x.id === slotId)
    if (s) s.cancel_requested = true
    // Real API:
    // const s = slots.find(x => x.id === slotId)
    // await axiosInstance.post(`/doctor/schedule/${s.schedule_id}/slots/${slotId}/request-cancel`, { ly_do })
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    await delay()
    slots = slots.filter(s => s.schedule_id !== scheduleId)
    // Real API:
    // await axiosInstance.delete(`/doctor/schedule/${scheduleId}`)
  },
}
