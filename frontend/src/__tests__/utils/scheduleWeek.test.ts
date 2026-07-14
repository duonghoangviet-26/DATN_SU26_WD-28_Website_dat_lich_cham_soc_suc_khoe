import { describe, expect, it } from 'vitest'
import { getMondayOfWeek, addDays, findCoveringLeave, todayTimeStatus } from '@/utils/scheduleWeek'
import type { DoctorLeaveRequest, DoctorSlot } from '@/types'

function slot(overrides: Partial<DoctorSlot> = {}): DoctorSlot {
  return {
    id: 's1', schedule_id: 'sched-1', ngay: '2026-07-15',
    gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active',
    ...overrides,
  }
}

function leave(overrides: Partial<DoctorLeaveRequest> = {}): DoctorLeaveRequest {
  return {
    id: 'l1', tu_ngay: '2026-07-15', den_ngay: '2026-07-15',
    ly_do: 'test', trang_thai: 'cho_duyet',
    ...overrides,
  }
}

describe('getMondayOfWeek', () => {
  it('trả về đúng Thứ Hai khi ngày truyền vào là giữa tuần (Thứ Tư)', () => {
    // 2026-07-15 là Thứ Tư
    const monday = getMondayOfWeek(new Date(2026, 6, 15))
    expect(monday.getFullYear()).toBe(2026)
    expect(monday.getMonth()).toBe(6)
    expect(monday.getDate()).toBe(13) // Thứ Hai 13/07
    expect(monday.getDay()).toBe(1)
  })

  it('Chủ nhật thuộc tuần bắt đầu từ Thứ Hai TRƯỚC đó (không phải tuần sau)', () => {
    // 2026-07-19 là Chủ nhật
    const monday = getMondayOfWeek(new Date(2026, 6, 19))
    expect(monday.getDate()).toBe(13)
    expect(monday.getDay()).toBe(1)
  })

  it('nếu ngày truyền vào đã là Thứ Hai thì trả về chính nó', () => {
    const monday = getMondayOfWeek(new Date(2026, 6, 13))
    expect(monday.getDate()).toBe(13)
  })

  it('vắt qua tháng: cuối tháng 7 sang đầu tháng 8', () => {
    // 2026-08-01 là Thứ Bảy — Thứ Hai của tuần đó là 2026-07-27
    const monday = getMondayOfWeek(new Date(2026, 7, 1))
    expect(monday.getMonth()).toBe(6) // tháng 7 (0-indexed = 6)
    expect(monday.getDate()).toBe(27)
  })
})

describe('addDays', () => {
  it('cộng ngày trong cùng tháng', () => {
    const d = addDays(new Date(2026, 6, 13), 5)
    expect(d.getDate()).toBe(18)
  })

  it('cộng ngày vắt qua tháng', () => {
    const d = addDays(new Date(2026, 6, 30), 3)
    expect(d.getMonth()).toBe(7) // tháng 8
    expect(d.getDate()).toBe(2)
  })

  it('trừ ngày (tuần trước) không làm thay đổi Date gốc truyền vào', () => {
    const original = new Date(2026, 6, 13)
    const prevWeekMonday = addDays(original, -7)
    expect(prevWeekMonday.getDate()).toBe(6)
    expect(original.getDate()).toBe(13) // không bị mutate
  })
})

describe('findCoveringLeave', () => {
  it('khớp đơn nghỉ cả ngày (không có gio_bat_dau/gio_ket_thuc) với mọi slot active trong ngày', () => {
    const s = slot({ gio_bat_dau: '14:00', gio_ket_thuc: '14:30' })
    const l = leave({ gio_bat_dau: null, gio_ket_thuc: null })
    expect(findCoveringLeave(s, [l])).toBe(l)
  })

  it('không khớp nếu slot khác ngày với đơn nghỉ', () => {
    const s = slot({ ngay: '2026-07-16' })
    const l = leave({ tu_ngay: '2026-07-15', den_ngay: '2026-07-15' })
    expect(findCoveringLeave(s, [l])).toBeUndefined()
  })

  it('khớp khi khung giờ đơn nghỉ giao nhau với slot', () => {
    const s = slot({ gio_bat_dau: '08:00', gio_ket_thuc: '08:30' })
    const l = leave({ gio_bat_dau: '08:00', gio_ket_thuc: '12:00' })
    expect(findCoveringLeave(s, [l])).toBe(l)
  })

  it('không khớp khi khung giờ đơn nghỉ không giao nhau với slot', () => {
    const s = slot({ gio_bat_dau: '08:00', gio_ket_thuc: '08:30' })
    const l = leave({ gio_bat_dau: '14:00', gio_ket_thuc: '17:30' })
    expect(findCoveringLeave(s, [l])).toBeUndefined()
  })

  it('bỏ qua đơn đã bị từ chối hoặc đã rút (chỉ tính cho_duyet/da_duyet)', () => {
    const s = slot()
    const rejected = leave({ trang_thai: 'tu_choi' })
    const withdrawn = leave({ trang_thai: 'da_huy' })
    expect(findCoveringLeave(s, [rejected, withdrawn])).toBeUndefined()
  })

  it('vẫn khớp với đơn đã duyệt (da_duyet), không chỉ cho_duyet', () => {
    const s = slot()
    const approved = leave({ trang_thai: 'da_duyet', gio_bat_dau: null, gio_ket_thuc: null })
    expect(findCoveringLeave(s, [approved])).toBe(approved)
  })
})

describe('todayTimeStatus', () => {
  it('trả về null nếu không có slot còn hiệu lực', () => {
    expect(todayTimeStatus([])).toBeNull()
    expect(todayTimeStatus([slot({ status: 'cancelled' })])).toBeNull()
  })

  it('"Sắp diễn ra" khi giờ hiện tại trước giờ bắt đầu sớm nhất', () => {
    const slots = [slot({ gio_bat_dau: '08:00', gio_ket_thuc: '08:30' })]
    const result = todayTimeStatus(slots, new Date(2026, 6, 15, 7, 0))
    expect(result?.label).toBe('Sắp diễn ra')
  })

  it('"Đang diễn ra" khi giờ hiện tại nằm trong khung giờ làm việc', () => {
    const slots = [
      slot({ gio_bat_dau: '08:00', gio_ket_thuc: '08:30' }),
      slot({ id: 's2', gio_bat_dau: '16:30', gio_ket_thuc: '17:00' }),
    ]
    const result = todayTimeStatus(slots, new Date(2026, 6, 15, 10, 0))
    expect(result?.label).toBe('Đang diễn ra')
  })

  it('"Đã kết thúc" khi giờ hiện tại sau giờ kết thúc muộn nhất', () => {
    const slots = [slot({ gio_bat_dau: '08:00', gio_ket_thuc: '17:30' })]
    const result = todayTimeStatus(slots, new Date(2026, 6, 15, 18, 0))
    expect(result?.label).toBe('Đã kết thúc')
  })

  it('bỏ qua slot cancelled/expired khi tính khung giờ làm việc', () => {
    const slots = [
      slot({ gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'cancelled' }),
      slot({ id: 's2', gio_bat_dau: '14:00', gio_ket_thuc: '14:30', status: 'active' }),
    ]
    // 09:00 lẽ ra "đang diễn ra" nếu tính cả slot cancelled (08:00-08:30 không còn hiệu lực) —
    // nhưng vì slot đó bị loại, khung giờ hiệu lực thực tế là 14:00-14:30 => "sắp diễn ra"
    const result = todayTimeStatus(slots, new Date(2026, 6, 15, 9, 0))
    expect(result?.label).toBe('Sắp diễn ra')
  })
})
