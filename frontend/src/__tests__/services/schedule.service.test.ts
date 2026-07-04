/**
 * Test suite: schedule.service.ts
 * B2 — Quản lý lịch làm việc của bác sĩ (rolling window T2–T7, 16 slot/ngày)
 *
 * Mock data tham chiếu (doctor-schedule.ts) — 6 ngày × 16 slot = 96 slot, chỉ 2 trạng
 * thái baked-in (booked, locked) + active mặc định — không còn cancelled/pending_payment/
 * phòng=null cố định trong data để giữ demo gọn và "hoàn chỉnh" (đủ phòng, đủ trạng thái
 * hợp lệ). Các test cần trạng thái cancelled/edge-case khác tự dựng precondition bằng
 * cách gọi service (vd. cancelSlot()/lockSlot() trước) thay vì phụ thuộc fixture cố định:
 *   Ngày 0 (hôm nay):
 *     id=1  : booked    Nguyễn Văn An (08:00–08:30)
 *     id=2  : booked    Trần Thị Bình (08:30–09:00)
 *     id=3  : booked    Võ Thị Hoa (09:00–09:30)
 *     id=9  : locked    (13:30–14:00, bác sĩ bận việc riêng)
 *     còn lại (4,5,6,7,8,10-16): active, đều có phòng
 *   Ngày 1 (ngày mai):
 *     id=17 : booked    Phạm Minh Quân (08:00–08:30)
 *     id=18 : booked    Lê Thị Lan (08:30–09:00)
 *     còn lại (19-32): active
 *   Ngày 2 (+2 ngày):
 *     id=33 : booked    Đặng Văn Quân (08:00–08:30)
 *     còn lại: active
 *   Ngày 3–5: tất cả active
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/schedule.service')
  return mod.scheduleService
}

// ─── getAll() ─────────────────────────────────────────────────────────────────

describe('getAll()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('trả về 96 slots ban đầu (6 ngày × 16 slot)', async () => {
    const slots = await svc.getAll()
    expect(slots.length).toBe(96)
  })

  it('kết quả sort theo ngày → giờ tăng dần', async () => {
    const slots = await svc.getAll()
    for (let i = 1; i < slots.length; i++) {
      const a = slots[i - 1], b = slots[i]
      expect(a.ngay.localeCompare(b.ngay) || a.gio_bat_dau.localeCompare(b.gio_bat_dau)).toBeLessThanOrEqual(0)
    }
  })

  it('mock có sẵn active / booked / locked — cancelled là trạng thái dựng động qua cancelSlot()', async () => {
    const slots = await svc.getAll()
    const statuses = new Set(slots.map((s) => s.status))
    expect(statuses.has('active')).toBe(true)
    expect(statuses.has('booked')).toBe(true)
    expect(statuses.has('locked')).toBe(true)
    // cancelled/expired không stored sẵn — cancelled chỉ tạo qua cancelSlot(), expired là giá trị computed trên UI
    expect(statuses.has('cancelled')).toBe(false)
    expect(statuses.has('expired')).toBe(false)
  })

  it('slot booked có benh_nhan_id, slot active có benh_nhan_id=null', async () => {
    const slots = await svc.getAll()
    const booked = slots.filter((s) => s.status === 'booked')
    const active = slots.filter((s) => s.status === 'active')
    expect(booked.length).toBeGreaterThan(0)
    expect(booked.every((s) => s.benh_nhan_id != null)).toBe(true)
    expect(active.every((s) => s.benh_nhan_id == null)).toBe(true)
  })

  it('mọi slot đều có phòng khám (dữ liệu demo hoàn chỉnh, không có phòng=null)', async () => {
    const slots = await svc.getAll()
    expect(slots.every((s) => !!s.phong_kham)).toBe(true)
  })

  it('16 slot/ngày đúng — hôm nay có đúng 16 slot', async () => {
    const slots = await svc.getAll()
    const today = slots[0].ngay
    const todaySlots = slots.filter((s) => s.ngay === today)
    expect(todaySlots.length).toBe(16)
  })
})

// ─── lockSlot() ───────────────────────────────────────────────────────────────

describe('lockSlot()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('active + không có BN → status=locked', async () => {
    const updated = await svc.lockSlot(4) // hôm nay, active
    expect(updated.status).toBe('locked')
  })

  it('booked (có BN) → throw "không thể khóa slot đã có bệnh nhân"', async () => {
    await expect(svc.lockSlot(1)).rejects.toThrow(/không thể khóa slot đã có bệnh nhân/i)
  })

  it('booked ngày mai → throw (guard không phụ thuộc ngày)', async () => {
    await expect(svc.lockSlot(17)).rejects.toThrow(/không thể khóa slot đã có bệnh nhân/i)
  })

  it('locked → throw "chỉ khóa được slot đang active"', async () => {
    await expect(svc.lockSlot(9)).rejects.toThrow(/chỉ khóa được slot đang active/i)
  })

  it('locked tương lai (tự khóa trước) → throw khi khóa lại', async () => {
    await svc.lockSlot(20) // ngày mai, active → khóa lần 1
    await expect(svc.lockSlot(20)).rejects.toThrow(/chỉ khóa được slot đang active/i)
  })

  it('cancelled (tự hủy trước) → throw "chỉ khóa được slot đang active"', async () => {
    await svc.cancelSlot(5) // hôm nay, active → hủy hẳn
    await expect(svc.lockSlot(5)).rejects.toThrow(/chỉ khóa được slot đang active/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.lockSlot(999)).rejects.toThrow()
  })
})

// ─── unlockSlot() ─────────────────────────────────────────────────────────────

describe('unlockSlot()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('locked hôm nay → status=active', async () => {
    const updated = await svc.unlockSlot(9)
    expect(updated.status).toBe('active')
  })

  it('locked tương lai (tự khóa trước) → status=active', async () => {
    await svc.lockSlot(20)
    const updated = await svc.unlockSlot(20)
    expect(updated.status).toBe('active')
  })

  it('active → throw "chỉ bỏ khóa slot đang bị khóa"', async () => {
    await expect(svc.unlockSlot(4)).rejects.toThrow(/chỉ bỏ khóa slot/i)
  })

  it('booked → throw (không được set active bừa bãi khi có BN)', async () => {
    await expect(svc.unlockSlot(1)).rejects.toThrow(/chỉ bỏ khóa slot/i)
  })

  it('cancelled (tự hủy trước) → throw', async () => {
    await svc.cancelSlot(5)
    await expect(svc.unlockSlot(5)).rejects.toThrow(/chỉ bỏ khóa slot/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.unlockSlot(999)).rejects.toThrow()
  })
})

// ─── cancelSlot() ─────────────────────────────────────────────────────────────

describe('cancelSlot() — dùng nội bộ, UI không expose trực tiếp', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('active → status=cancelled', async () => {
    const updated = await svc.cancelSlot(20)
    expect(updated.status).toBe('cancelled')
  })

  it('locked → status=cancelled (BS khóa rồi Admin quyết định hủy hẳn)', async () => {
    const updated = await svc.cancelSlot(9)
    expect(updated.status).toBe('cancelled')
  })

  it('booked → throw "slot đã có bệnh nhân" (BUG-S03 fix: phải qua Admin)', async () => {
    await expect(svc.cancelSlot(1)).rejects.toThrow(/slot đã có bệnh nhân/i)
  })

  it('booked ngày mai → throw (guard không phụ thuộc ngày)', async () => {
    await expect(svc.cancelSlot(17)).rejects.toThrow(/slot đã có bệnh nhân/i)
  })

  it('đã cancelled (tự hủy trước) → throw "slot đã bị hủy rồi"', async () => {
    await svc.cancelSlot(20)
    await expect(svc.cancelSlot(20)).rejects.toThrow(/slot đã bị hủy rồi/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.cancelSlot(999)).rejects.toThrow()
  })

  it('cancelSlot không xóa — slot vẫn tồn tại với status=cancelled', async () => {
    await svc.cancelSlot(20)
    const all = await svc.getAll()
    const slot = all.find((s) => Number(s.id) === 20)
    expect(slot).toBeDefined()
    expect(slot!.status).toBe('cancelled')
  })
})

// ─── requestCancelSlot() ──────────────────────────────────────────────────────

describe('requestCancelSlot()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('booked hôm nay + lý do đầy đủ → resolve void', async () => {
    await expect(svc.requestCancelSlot(1, 'Bác sĩ có việc đột xuất')).resolves.toBeUndefined()
  })

  it('booked ngày mai + lý do đầy đủ → resolve void', async () => {
    await expect(svc.requestCancelSlot(17, 'Lý do khẩn cấp')).resolves.toBeUndefined()
  })

  it('slot booked vẫn giữ status=booked sau khi request — Admin mới xử lý', async () => {
    await svc.requestCancelSlot(1, 'Lý do test')
    const all = await svc.getAll()
    expect(all.find((s) => Number(s.id) === 1)?.status).toBe('booked')
  })

  it('active slot → throw "chỉ yêu cầu hủy slot đã có bệnh nhân"', async () => {
    await expect(svc.requestCancelSlot(4, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
  })

  it('locked slot → throw', async () => {
    await expect(svc.requestCancelSlot(9, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
  })

  it('cancelled (tự hủy trước) slot → throw', async () => {
    await svc.cancelSlot(20)
    await expect(svc.requestCancelSlot(20, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
  })

  it('lý do rỗng → throw "vui lòng nhập lý do"', async () => {
    await expect(svc.requestCancelSlot(1, '')).rejects.toThrow(/vui lòng nhập lý do/i)
  })

  it('lý do chỉ có khoảng trắng → throw "vui lòng nhập lý do"', async () => {
    await expect(svc.requestCancelSlot(1, '   ')).rejects.toThrow(/vui lòng nhập lý do/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.requestCancelSlot(999, 'Lý do')).rejects.toThrow()
  })
})

// ─── updatePhongKham() ────────────────────────────────────────────────────────

describe('updatePhongKham()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('active + không BN → cập nhật phòng mới', async () => {
    const updated = await svc.updatePhongKham(4, 'Phòng 301, Tầng 3, Tòa B')
    expect(updated.phong_kham).toBe('Phòng 301, Tầng 3, Tòa B')
  })

  it('active → set null (xóa phòng)', async () => {
    const updated = await svc.updatePhongKham(4, null)
    expect(updated.phong_kham).toBeNull()
  })

  it('locked + không BN → cập nhật phòng được', async () => {
    const updated = await svc.updatePhongKham(9, 'Phòng 202')
    expect(updated.phong_kham).toBe('Phòng 202')
  })

  it('locked tương lai (tự khóa trước) → cập nhật phòng được', async () => {
    await svc.lockSlot(20)
    const updated = await svc.updatePhongKham(20, 'Phòng Mới')
    expect(updated.phong_kham).toBe('Phòng Mới')
  })

  it('booked (có BN) → throw "không thể sửa phòng khi slot đã có bệnh nhân"', async () => {
    await expect(svc.updatePhongKham(1, 'Phòng X')).rejects.toThrow(/không thể sửa phòng khi slot đã có bệnh nhân/i)
  })

  it('booked ngày mai → throw (guard không phụ thuộc ngày)', async () => {
    await expect(svc.updatePhongKham(17, 'Phòng X')).rejects.toThrow(/không thể sửa phòng khi slot đã có bệnh nhân/i)
  })

  it('cancelled (tự hủy trước) → throw "chỉ sửa phòng khi slot đang active hoặc locked"', async () => {
    await svc.cancelSlot(20)
    await expect(svc.updatePhongKham(20, 'Phòng X')).rejects.toThrow(/chỉ sửa phòng khi slot đang active hoặc locked/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.updatePhongKham(999, 'Phòng X')).rejects.toThrow()
  })

  it('sau updatePhongKham → getAll() phản ánh giá trị mới', async () => {
    await svc.updatePhongKham(4, 'Phòng Mới 999')
    const all = await svc.getAll()
    expect(all.find((s) => Number(s.id) === 4)?.phong_kham).toBe('Phòng Mới 999')
  })
})

// ─── Luồng tổng hợp ───────────────────────────────────────────────────────────

describe('Luồng tổng hợp — state machine', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('lock → unlock → lock lại (cycle 2 lần) → unlock cuối → active', async () => {
    const locked1 = await svc.lockSlot(4)
    expect(locked1.status).toBe('locked')

    const unlocked1 = await svc.unlockSlot(4)
    expect(unlocked1.status).toBe('active')

    const locked2 = await svc.lockSlot(4)
    expect(locked2.status).toBe('locked')

    const unlocked2 = await svc.unlockSlot(4)
    expect(unlocked2.status).toBe('active')
  })

  it('cancel active → lock/unlock/cancel đều throw (cancelled là trạng thái cuối)', async () => {
    await svc.cancelSlot(20)
    await expect(svc.lockSlot(20)).rejects.toThrow()
    await expect(svc.unlockSlot(20)).rejects.toThrow()
    await expect(svc.cancelSlot(20)).rejects.toThrow()
  })

  it('requestCancelSlot không thay đổi state — slot vẫn booked sau khi gửi', async () => {
    const before = await svc.getAll()
    const slotBefore = before.find((s) => Number(s.id) === 1)!
    expect(slotBefore.status).toBe('booked')

    await svc.requestCancelSlot(1, 'Lý do test đột xuất')

    const after = await svc.getAll()
    const slotAfter = after.find((s) => Number(s.id) === 1)!
    expect(slotAfter.status).toBe('booked')
    expect(slotAfter.benh_nhan_id).toBe(slotBefore.benh_nhan_id)
  })

  it('lock slot booked → throw, booked slot không bị ảnh hưởng', async () => {
    await expect(svc.lockSlot(1)).rejects.toThrow()
    const all = await svc.getAll()
    expect(all.find((s) => Number(s.id) === 1)?.status).toBe('booked')
  })

  it('state isolation: mỗi test bắt đầu từ 96 slots ban đầu, đúng trạng thái gốc', async () => {
    const slots = await svc.getAll()
    expect(slots.length).toBe(96)
    expect(slots.find((s) => Number(s.id) === 1)?.status).toBe('booked')
    expect(slots.find((s) => Number(s.id) === 2)?.status).toBe('booked')
    expect(slots.find((s) => Number(s.id) === 3)?.status).toBe('booked')
    expect(slots.find((s) => Number(s.id) === 9)?.status).toBe('locked')
  })
})

// ─── lockDay() — "Nghỉ cả ngày" ────────────────────────────────────────────────

describe('lockDay()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('khóa toàn bộ slot active trong ngày, không đụng booked/locked', async () => {
    const all = await svc.getAll()
    const today = all[0].ngay
    const activeBeforeCount = all.filter((s) => s.ngay === today && s.status === 'active').length

    const { locked } = await svc.lockDay(today)
    expect(locked).toBe(activeBeforeCount)

    const after = await svc.getAll()
    const todaySlots = after.filter((s) => s.ngay === today)
    expect(todaySlots.find((s) => Number(s.id) === 1)?.status).toBe('booked')
    expect(todaySlots.find((s) => Number(s.id) === 2)?.status).toBe('booked')
    expect(todaySlots.find((s) => Number(s.id) === 3)?.status).toBe('booked')
    expect(todaySlots.find((s) => Number(s.id) === 9)?.status).toBe('locked')
    expect(todaySlots.some((s) => s.status === 'active')).toBe(false)
  })

  it('gọi lần 2 khi không còn slot active → locked=0, không throw', async () => {
    const today = (await svc.getAll())[0].ngay
    await svc.lockDay(today)
    const { locked } = await svc.lockDay(today)
    expect(locked).toBe(0)
  })

  it('chỉ ảnh hưởng đúng ngày được chọn — ngày khác giữ nguyên', async () => {
    const all = await svc.getAll()
    const today = all[0].ngay
    const otherDay = all.find((s) => s.ngay !== today)!.ngay
    const otherActiveBefore = all.filter((s) => s.ngay === otherDay && s.status === 'active').length

    await svc.lockDay(today)

    const after = await svc.getAll()
    const otherActiveAfter = after.filter((s) => s.ngay === otherDay && s.status === 'active').length
    expect(otherActiveAfter).toBe(otherActiveBefore)
  })

  it('ngày không có lịch nào → locked=0, không throw', async () => {
    const { locked } = await svc.lockDay('2099-12-31')
    expect(locked).toBe(0)
  })
})

// ─── syncSlotOnAppointmentCancel() — đồng bộ khi hủy lịch hẹn clinic (B3) ─────

describe('syncSlotOnAppointmentCancel()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  let sync: (ngay: string, gio: string) => void

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/services/schedule.service')
    svc = mod.scheduleService
    sync = mod.syncSlotOnAppointmentCancel
  })

  it('khớp (ngay, gio_bat_dau) của slot booked → khóa vĩnh viễn (locked), không trả về active', async () => {
    // id=1: hôm nay, 08:00–08:30, đang booked (khớp rule doctor/appointments.controller.js:150-152)
    const before = (await svc.getAll()).find((s) => Number(s.id) === 1)!
    expect(before.status).toBe('booked')

    sync(before.ngay, before.gio_bat_dau)

    const after = (await svc.getAll()).find((s) => Number(s.id) === 1)!
    expect(after.status).toBe('locked')
  })

  it('không khớp (ngay, giờ) của slot nào → không throw, không đổi state nào khác', async () => {
    const before = await svc.getAll()
    expect(() => sync('2099-01-01', '23:45')).not.toThrow()
    const after = await svc.getAll()
    expect(after).toEqual(before)
  })
})
