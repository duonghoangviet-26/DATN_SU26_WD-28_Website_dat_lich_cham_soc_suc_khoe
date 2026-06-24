import type { DoctorSlot } from '@/types'
import { toLocalDateStr } from '@/utils/format'

// 16 slot/ngày — nghỉ trưa 12:00–13:30 (TBD-1: phương án C)
const SLOT_TIMES: [string, string][] = [
  ['08:00', '08:30'], ['08:30', '09:00'], ['09:00', '09:30'], ['09:30', '10:00'],
  ['10:00', '10:30'], ['10:30', '11:00'], ['11:00', '11:30'], ['11:30', '12:00'],
  // 12:00–13:30 nghỉ trưa
  ['13:30', '14:00'], ['14:00', '14:30'], ['14:30', '15:00'], ['15:00', '15:30'],
  ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'], ['17:00', '17:30'],
]

const PHONG = [
  'Phòng 201, Tầng 2, Tòa A',
  'Phòng 305, Tầng 3, Tòa B',
  'Phòng 102, Tầng 1, Tòa A',
]

// Rolling 6 ngày T2–T7 từ hôm nay (bỏ CN) — TBD-2: cron job duy trì window này
function getRollingWindow(): string[] {
  const dates: string[] = []
  const cur = new Date()
  while (dates.length < 6) {
    if (cur.getDay() !== 0) dates.push(toLocalDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function buildSlots(): DoctorSlot[] {
  const window = getRollingWindow()
  const all: DoctorSlot[] = []
  let id = 1

  window.forEach((ngay, dayIdx) => {
    SLOT_TIMES.forEach(([bat_dau, ket_thuc], slotIdx) => {
      const base: DoctorSlot = {
        id,
        ngay,
        gio_bat_dau: bat_dau,
        gio_ket_thuc: ket_thuc,
        phong_kham: PHONG[id % 3],
        benh_nhan: null,
        benh_nhan_id: null,
        status: 'active',
      }

      let slot = base

      if (dayIdx === 0) {
        // Hôm nay — id 1–16
        // id=1 (slotIdx=0):  booked  — test Yêu cầu hủy, guard lockSlot/updatePhongKham booked
        // id=5 (slotIdx=4):  active phong=null — test warning chưa có phòng + lock null phong
        // id=9 (slotIdx=8):  locked  — test Mở lại, guard unlockSlot
        // id=16 (slotIdx=15): cancelled — test guard cancelSlot/lockSlot/unlockSlot/updatePhongKham
        if (slotIdx === 0) {
          slot = { ...base, status: 'booked', benh_nhan: 'Trần Thị Bình', benh_nhan_id: 2, phong_kham: PHONG[0] }
        } else if (slotIdx === 4) {
          slot = { ...base, phong_kham: null }
        } else if (slotIdx === 8) {
          slot = { ...base, status: 'locked', phong_kham: PHONG[1] }
        } else if (slotIdx === 15) {
          slot = { ...base, status: 'cancelled', phong_kham: PHONG[0] }
        }
      } else if (dayIdx === 1) {
        // Ngày mai — id 17–32
        // id=17 (slotIdx=0): booked  — test 2nd booked slot
        // id=19 (slotIdx=2): active phong=null
        if (slotIdx === 0) {
          slot = { ...base, status: 'booked', benh_nhan: 'Phạm Minh Quân', benh_nhan_id: 5, phong_kham: PHONG[0] }
        } else if (slotIdx === 2) {
          slot = { ...base, phong_kham: null }
        }
      } else if (dayIdx === 2) {
        // +2 ngày — id 33–48
        // id=33 (slotIdx=0): locked  — test unlockSlot tương lai, cancelSlot locked
        // id=36 (slotIdx=3): active phong=null
        if (slotIdx === 0) {
          slot = { ...base, status: 'locked', phong_kham: PHONG[0] }
        } else if (slotIdx === 3) {
          slot = { ...base, phong_kham: null }
        }
      } else {
        // Days 3–5: all active, rải phong=null để test UI
        if (slotIdx % 6 === 5) slot = { ...base, phong_kham: null }
      }

      all.push(slot)
      id++
    })
  })

  return all
}

// 6 ngày × 16 slot = 96 slot tổng
export const mockSlots: DoctorSlot[] = buildSlots()
