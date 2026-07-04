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

  // id nhận string|number vì UI truyền slot.id (string) nhưng có thể gọi trực tiếp bằng number.
  async lockSlot(id: string | number): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => String(x.id) === String(id))
    if (!s) throw new Error('Không tìm thấy slot')
    if (s.status === 'booked') throw new Error('Không thể khóa slot đã có bệnh nhân')
    if (s.status !== 'active') throw new Error('Chỉ khóa được slot đang active')
    s.status = 'locked'
    return { ...s }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${scheduleId}/slots/${id}`, { status: 'locked' })
    // return res.data.data
  },

  async unlockSlot(id: string | number): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => String(x.id) === String(id))
    if (!s) throw new Error('Không tìm thấy slot')
    if (s.status !== 'locked') throw new Error('Chỉ bỏ khóa slot đang bị khóa')
    s.status = 'active'
    return { ...s }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${scheduleId}/slots/${id}`, { status: 'active' })
    // return res.data.data
  },

  // Hủy hẳn 1 slot — dùng nội bộ (Admin), UI bác sĩ không expose trực tiếp.
  // Bác sĩ chỉ "Tạm nghỉ" (lockSlot); hủy hẳn khỏi lịch là quyết định của Admin (BUG-S03).
  async cancelSlot(id: string | number): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => String(x.id) === String(id))
    if (!s) throw new Error('Không tìm thấy slot')
    if (s.status === 'booked') throw new Error('Slot đã có bệnh nhân, không thể hủy trực tiếp')
    if (s.status === 'cancelled') throw new Error('Slot đã bị hủy rồi')
    s.status = 'cancelled'
    return { ...s }
  },

  async updatePhongKham(id: string | number, phong_kham: string | null): Promise<DoctorSlot> {
    await delay()
    const s = slots.find(x => String(x.id) === String(id))
    if (!s) throw new Error('Không tìm thấy slot')
    if (s.status === 'booked') throw new Error('Không thể sửa phòng khi slot đã có bệnh nhân')
    if (s.status !== 'active' && s.status !== 'locked') throw new Error('Chỉ sửa phòng khi slot đang active hoặc locked')
    s.phong_kham = phong_kham
    return { ...s }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorSlot>>(`/doctor/schedule/${scheduleId}/slots/${id}`, { phong_kham })
    // return res.data.data
  },

  async requestCancelSlot(id: string | number, ly_do: string): Promise<void> {
    await delay()
    const s = slots.find(x => String(x.id) === String(id))
    if (!s) throw new Error('Không tìm thấy slot')
    if (s.status !== 'booked') throw new Error('Chỉ yêu cầu hủy slot đã có bệnh nhân')
    if (!ly_do?.trim()) throw new Error('Vui lòng nhập lý do')
    // Cập nhật mảng slots gốc — nếu không, cờ cancel_requested bị mất khi trang gọi lại getAll()
    // (ví dụ đổi tab rồi quay lại) vì state cục bộ ở component không đồng bộ với "DB" mock này.
    s.cancel_requested = true
    // Real API:
    // await axiosInstance.post(`/doctor/schedule/${s.schedule_id}/slots/${id}/request-cancel`, { ly_do })
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    await delay()
    slots = slots.filter(s => s.schedule_id !== scheduleId)
    // Real API:
    // await axiosInstance.delete(`/doctor/schedule/${scheduleId}`)
  },

  // Nghỉ cả ngày — khóa 1 lần tất cả slot 'active' của 1 ngày (không đụng slot 'booked').
  async lockDay(ngay: string): Promise<{ locked: number }> {
    await delay()
    let locked = 0
    slots = slots.map(s => {
      if (s.ngay === ngay && s.status === 'active') {
        locked++
        return { ...s, status: 'locked' as const }
      }
      return s
    })
    return { locked }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ schedule_id: string; locked: number }>>('/doctor/schedule/day-off', { ngay })
    // return res.data.data
  },
}

// Đồng bộ trạng thái slot khi 1 lịch hẹn clinic liên quan bị hủy từ trang Lịch hẹn (B3) —
// khớp rule thật ở backend (doctor/appointments.controller.js cancel()): hủy khẩn cấp
// (clinic, confirmed) → slot 'locked' vĩnh viễn, KHÔNG trả về 'active' để bác sĩ không tự
// nhận lại đúng ca đó. Dùng (ngay, gio_bat_dau) để khớp vì mock 2 bên không có FK slot_id.
export function syncSlotOnAppointmentCancel(ngay_kham: string, gio_kham: string) {
  const s = slots.find(x => x.ngay === ngay_kham && x.gio_bat_dau === gio_kham)
  if (s) s.status = 'locked'
}
