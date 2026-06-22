import type { DoctorSlot } from '@/types'
import { mockSlots } from '@/mock/doctor-schedule'
import { delay, findOrThrow } from '@/utils/format'

let slots: DoctorSlot[] = [...mockSlots]
let nextId = slots.length + 1

type AddSlotData = Pick<DoctorSlot, 'ngay' | 'gio_bat_dau' | 'gio_ket_thuc' | 'phong_kham'>

export const scheduleService = {
  async getAll(): Promise<DoctorSlot[]> {
    await delay()
    return [...slots].sort(
      (a, b) => a.ngay.localeCompare(b.ngay) || a.gio_bat_dau.localeCompare(b.gio_bat_dau),
    )
  },

  async addSlot(data: AddSlotData): Promise<DoctorSlot> {
    await delay(200)
    const newSlot: DoctorSlot = {
      ...data,
      id: nextId++,
      benh_nhan: null,
      benh_nhan_id: null,
      status: 'active',
    }
    slots = [...slots, newSlot]
    return newSlot
  },

  async lockSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.benh_nhan_id != null) throw new Error('Không thể khóa slot đã có bệnh nhân đặt')
    slots = slots.map((s) => s.id === id ? { ...s, status: 'locked' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  async unlockSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    slots = slots.map((s) => s.id === id ? { ...s, status: 'active' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  async cancelSlot(id: number): Promise<DoctorSlot> {
    await delay(200)
    slots = slots.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s)
    return findOrThrow(slots, id, 'Slot')
  },

  async deleteSlot(id: number): Promise<void> {
    await delay(200)
    const slot = findOrThrow(slots, id, 'Slot')
    if (slot.benh_nhan_id != null) {
      throw new Error('Không thể xóa slot đã có bệnh nhân đặt lịch')
    }
    slots = slots.filter((s) => s.id !== id)
  },
}
