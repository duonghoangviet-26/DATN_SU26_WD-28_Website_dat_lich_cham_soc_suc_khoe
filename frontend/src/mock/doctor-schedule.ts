import type { DoctorSlot } from '@/types'
import { toLocalDateStr } from '@/utils/format'

// 16 slot/ngày — nghỉ trưa 12:00–13:30
const SLOT_TIMES: [string, string][] = [
  ['08:00', '08:30'], ['08:30', '09:00'], ['09:00', '09:30'], ['09:30', '10:00'],
  ['10:00', '10:30'], ['10:30', '11:00'], ['11:00', '11:30'], ['11:30', '12:00'],
  // 12:00–13:30 nghỉ trưa
  ['13:30', '14:00'], ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
  ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'], ['17:00', '17:30'],
]

const PHONG = 'Phòng 201, Tầng 2, Tòa A'

// Rolling 6 ngày T2–T7 từ hôm nay (bỏ CN)
function getRollingWindow(): string[] {
  const dates: string[] = []
  const cur = new Date()
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(toLocalDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// Khớp với mock/doctor-appointments.ts: 3 ca đầu hôm nay, ca đầu + ca 2 ngày mai, và ca
// đầu +2 ngày đã có bệnh nhân đặt (chỉ loai_kham='clinic' — home không dùng slot system).
function buildSlots(): DoctorSlot[] {
  const window = getRollingWindow()
  const all: DoctorSlot[] = []
  let slotNum = 1

  window.forEach((ngay, dayIdx) => {
    const scheduleId = `sched-mock-${String(dayIdx + 1).padStart(3, '0')}`

    SLOT_TIMES.forEach(([bat_dau, ket_thuc], slotIdx) => {
      let slot: DoctorSlot = {
        id: String(slotNum),
        schedule_id: scheduleId,
        ngay,
        gio_bat_dau: bat_dau,
        gio_ket_thuc: ket_thuc,
        phong_kham: PHONG,
        benh_nhan: null,
        benh_nhan_id: null,
        status: 'active',
      }

      if (dayIdx === 0) {
        if (slotIdx === 0) slot = { ...slot, status: 'booked', benh_nhan: 'Nguyễn Văn An', benh_nhan_id: '1' }
        else if (slotIdx === 1) slot = { ...slot, status: 'booked', benh_nhan: 'Trần Thị Bình', benh_nhan_id: '2' }
        else if (slotIdx === 2) slot = { ...slot, status: 'booked', benh_nhan: 'Võ Thị Hoa', benh_nhan_id: '3' }
        else if (slotIdx === 8) slot = { ...slot, status: 'locked' } // bác sĩ bận việc riêng đầu giờ chiều
      } else if (dayIdx === 1) {
        if (slotIdx === 0) slot = { ...slot, status: 'booked', benh_nhan: 'Phạm Minh Quân', benh_nhan_id: '4' }
        else if (slotIdx === 1) slot = { ...slot, status: 'booked', benh_nhan: 'Lê Thị Lan', benh_nhan_id: '5' }
      } else if (dayIdx === 2 && slotIdx === 0) {
        slot = { ...slot, status: 'booked', benh_nhan: 'Đặng Văn Quân', benh_nhan_id: '6' }
      }

      all.push(slot)
      slotNum++
    })
  })

  return all
}

// 6 ngày × 16 slot = 96 slot tổng
export const mockSlots: DoctorSlot[] = buildSlots()
