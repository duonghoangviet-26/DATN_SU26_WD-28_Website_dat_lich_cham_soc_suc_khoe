import type { DoctorSlot } from '@/types'
import { mockSlots } from '@/mock/doctor-schedule'
import { delay, findOrThrow } from '@/utils/format'

let slots: DoctorSlot[] = [...mockSlots]

export const scheduleService = {
  async getAll(): Promise<DoctorSlot[]> {
    await delay()
    return [...slots].sort(
      (a, b) => a.ngay.localeCompare(b.ngay) || a.gio_bat_dau.localeCompare(b.gio_bat_dau),
    )
  },

  async lockSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.status === 'booked') {
      throw new Error('Không thể khóa slot đã có bệnh nhân đặt')
    }
    if (slot.status !== 'active') {
      throw new Error('Chỉ khóa được slot đang active')
    }
    slots = slots.map((s) => s.id === id ? { ...s, status: 'locked' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  async unlockSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.status !== 'locked') {
      throw new Error('Chỉ bỏ khóa slot đang bị khóa')
    }
    slots = slots.map((s) => s.id === id ? { ...s, status: 'active' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  // Dùng nội bộ (Admin trigger). UI không expose trực tiếp.
  async cancelSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.status === 'booked') {
      throw new Error('Slot đã có bệnh nhân — hủy qua quy trình Admin để hoàn tiền')
    }
    if (slot.status === 'cancelled') {
      throw new Error('Slot đã bị hủy rồi')
    }
    slots = slots.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  // Bác sĩ gửi yêu cầu hủy slot đã có bệnh nhân → Admin xử lý → hoàn tiền BN
  async requestCancelSlot(id: number, ly_do: string): Promise<void> {
    await delay(300)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.status !== 'booked') {
      throw new Error('Chỉ yêu cầu hủy slot đã có bệnh nhân đặt lịch')
    }
    if (!ly_do.trim()) {
      throw new Error('Vui lòng nhập lý do yêu cầu hủy')
    }
    // Mock: slot vẫn giữ nguyên 'booked'. Admin nhận yêu cầu, xử lý riêng.
    console.log(`[Mock] Yêu cầu hủy slot ${id}: "${ly_do}"`)
  },

  async updatePhongKham(id: number, phong_kham: string | null): Promise<DoctorSlot> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.benh_nhan_id != null) {
      throw new Error('Không thể sửa phòng khi slot đã có bệnh nhân')
    }
    if (!['active', 'locked'].includes(slot.status)) {
      throw new Error('Chỉ sửa phòng khi slot đang active hoặc locked')
    }
    slots = slots.map((s) => (s.id === id ? { ...s, phong_kham } : s))
    return findOrThrow(slots, id, 'Slot')
  },
}
