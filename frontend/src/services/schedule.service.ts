import type { DoctorSlot } from '@/types'
import { mockSlots } from '@/mock/doctor-schedule'
import { delay, findOrThrow } from '@/utils/format'

let slots: DoctorSlot[] = [...mockSlots]
let nextId = slots.length + 1

export const scheduleService = {
  async getAll(): Promise<DoctorSlot[]> {
    await delay()
    return [...slots].sort((a, b) => a.ngay.localeCompare(b.ngay) || a.gio_bat_dau.localeCompare(b.gio_bat_dau))
  },

  async addSlot(data: Omit<DoctorSlot, 'id' | 'so_benh_nhan_hien_tai' | 'status'>): Promise<DoctorSlot> {
    await delay(200)
    const newSlot: DoctorSlot = {
      ...data,
      id: nextId++,
      so_benh_nhan_hien_tai: 0,
      status: 'active',
    }
    slots = [...slots, newSlot]
    return newSlot
  },

  async cancelSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    slots = slots.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  async deleteSlot(id: number): Promise<void> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.so_benh_nhan_hien_tai > 0) {
      throw new Error('Không thể xóa slot đã có bệnh nhân đặt lịch')
    }
    slots = slots.filter((s) => s.id !== id)
  },
}
