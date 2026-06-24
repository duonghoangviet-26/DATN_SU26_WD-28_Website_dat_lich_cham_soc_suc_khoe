/**
 * Test suite: schedule.service.ts
 * B2 — Quản lý lịch làm việc của bác sĩ (rolling window T2–T7, 16 slot/ngày)
 *
 * Mock data tham chiếu (doctor-schedule.ts) — 6 ngày × 16 slot = 96 slot:
 *   Ngày 0 (hôm nay):
 *     id=1  : booked    Trần Thị Bình benh_nhan_id=2  (08:00–08:30)
 *     id=2  : active    phong set                     (08:30–09:00)
 *     id=3  : active                                   (09:00–09:30)
 *     id=4  : active                                   (09:30–10:00)
 *     id=5  : active    phong_kham=null               (10:00–10:30)
 *     id=6–8: active
 *     id=9  : locked    phong set                     (13:30–14:00)
 *     id=10–15: active
 *     id=16 : cancelled                               (17:00–17:30)
 *   Ngày 1 (ngày mai):
 *     id=17 : booked    Phạm Minh Quân benh_nhan_id=5 (08:00–08:30)
 *     id=18 : active                                   (08:30–09:00)
 *     id=19 : active    phong_kham=null               (09:00–09:30)
 *     id=20–32: active
 *   Ngày 2 (+2 ngày):
 *     id=33 : locked    phong set                     (08:00–08:30)
 *     id=34–48: active
 *   Ngày 3–5: tất cả active (một số phong=null)
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

  it('mock có đủ 4 status stored: active / booked / locked / cancelled', async () => {
    const slots = await svc.getAll()
    const statuses = new Set(slots.map((s) => s.status))
    expect(statuses.has('active')).toBe(true)
    expect(statuses.has('booked')).toBe(true)
    expect(statuses.has('locked')).toBe(true)
    expect(statuses.has('cancelled')).toBe(true)
    // expired không stored — là giá trị computed trên UI cho slot past
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
    const updated = await svc.lockSlot(2)
    expect(updated.status).toBe('locked')
  })

  it('active với phong_kham=null → vẫn lock được', async () => {
    const updated = await svc.lockSlot(5)
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

  it('locked tương lai → throw', async () => {
    await expect(svc.lockSlot(33)).rejects.toThrow(/chỉ khóa được slot đang active/i)
  })

  it('cancelled → throw "chỉ khóa được slot đang active"', async () => {
    await expect(svc.lockSlot(16)).rejects.toThrow(/chỉ khóa được slot đang active/i)
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

  it('locked tương lai → status=active', async () => {
    const updated = await svc.unlockSlot(33)
    expect(updated.status).toBe('active')
  })

  it('active → throw "chỉ bỏ khóa slot đang bị khóa"', async () => {
    await expect(svc.unlockSlot(2)).rejects.toThrow(/chỉ bỏ khóa slot/i)
  })

  it('booked → throw (không được set active bừa bãi khi có BN)', async () => {
    await expect(svc.unlockSlot(1)).rejects.toThrow(/chỉ bỏ khóa slot/i)
  })

  it('cancelled → throw', async () => {
    await expect(svc.unlockSlot(16)).rejects.toThrow(/chỉ bỏ khóa slot/i)
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
    const updated = await svc.cancelSlot(18)
    expect(updated.status).toBe('cancelled')
  })

  it('locked → status=cancelled (BS khóa rồi Admin quyết định hủy hẳn)', async () => {
    const updated = await svc.cancelSlot(33)
    expect(updated.status).toBe('cancelled')
  })

  it('booked → throw "slot đã có bệnh nhân" (BUG-S03 fix: phải qua Admin)', async () => {
    await expect(svc.cancelSlot(1)).rejects.toThrow(/slot đã có bệnh nhân/i)
  })

  it('booked ngày mai → throw (guard không phụ thuộc ngày)', async () => {
    await expect(svc.cancelSlot(17)).rejects.toThrow(/slot đã có bệnh nhân/i)
  })

  it('đã cancelled → throw "slot đã bị hủy rồi"', async () => {
    await expect(svc.cancelSlot(16)).rejects.toThrow(/slot đã bị hủy rồi/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.cancelSlot(999)).rejects.toThrow()
  })

  it('cancelSlot không xóa — slot vẫn tồn tại với status=cancelled', async () => {
    await svc.cancelSlot(18)
    const all = await svc.getAll()
    const slot = all.find((s) => s.id === 18)
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
    expect(all.find((s) => s.id === 1)?.status).toBe('booked')
  })

  it('active slot → throw "chỉ yêu cầu hủy slot đã có bệnh nhân"', async () => {
    await expect(svc.requestCancelSlot(2, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
  })

  it('locked slot → throw', async () => {
    await expect(svc.requestCancelSlot(9, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
  })

  it('cancelled slot → throw', async () => {
    await expect(svc.requestCancelSlot(16, 'Lý do')).rejects.toThrow(/chỉ yêu cầu hủy slot đã có bệnh nhân/i)
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
    const updated = await svc.updatePhongKham(2, 'Phòng 301, Tầng 3, Tòa B')
    expect(updated.phong_kham).toBe('Phòng 301, Tầng 3, Tòa B')
  })

  it('active + phong_kham=null → set null (xóa phòng)', async () => {
    const updated = await svc.updatePhongKham(2, null)
    expect(updated.phong_kham).toBeNull()
  })

  it('active + phong_kham đang null → set phòng mới', async () => {
    const updated = await svc.updatePhongKham(5, 'Phòng 101')
    expect(updated.phong_kham).toBe('Phòng 101')
  })

  it('locked + không BN → cập nhật phòng được', async () => {
    const updated = await svc.updatePhongKham(9, 'Phòng 202')
    expect(updated.phong_kham).toBe('Phòng 202')
  })

  it('locked tương lai → cập nhật phòng được', async () => {
    const updated = await svc.updatePhongKham(33, 'Phòng Mới')
    expect(updated.phong_kham).toBe('Phòng Mới')
  })

  it('booked (có BN) → throw "không thể sửa phòng khi slot đã có bệnh nhân"', async () => {
    await expect(svc.updatePhongKham(1, 'Phòng X')).rejects.toThrow(/không thể sửa phòng khi slot đã có bệnh nhân/i)
  })

  it('booked ngày mai → throw (guard không phụ thuộc ngày)', async () => {
    await expect(svc.updatePhongKham(17, 'Phòng X')).rejects.toThrow(/không thể sửa phòng khi slot đã có bệnh nhân/i)
  })

  it('cancelled → throw "chỉ sửa phòng khi slot đang active hoặc locked"', async () => {
    await expect(svc.updatePhongKham(16, 'Phòng X')).rejects.toThrow(/chỉ sửa phòng khi slot đang active hoặc locked/i)
  })

  it('id không tồn tại → throw', async () => {
    await expect(svc.updatePhongKham(999, 'Phòng X')).rejects.toThrow()
  })

  it('sau updatePhongKham → getAll() phản ánh giá trị mới', async () => {
    await svc.updatePhongKham(2, 'Phòng Mới 999')
    const all = await svc.getAll()
    expect(all.find((s) => s.id === 2)?.phong_kham).toBe('Phòng Mới 999')
  })
})

// ─── Luồng tổng hợp ───────────────────────────────────────────────────────────

describe('Luồng tổng hợp — state machine', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('lock → unlock → lock lại (cycle 2 lần) → unlock cuối → active', async () => {
    const locked1 = await svc.lockSlot(2)
    expect(locked1.status).toBe('locked')

    const unlocked1 = await svc.unlockSlot(2)
    expect(unlocked1.status).toBe('active')

    const locked2 = await svc.lockSlot(2)
    expect(locked2.status).toBe('locked')

    const unlocked2 = await svc.unlockSlot(2)
    expect(unlocked2.status).toBe('active')
  })

  it('cancel active → lock/unlock/cancel đều throw (cancelled là trạng thái cuối)', async () => {
    // Dùng id=18 (active ngày mai)
    await svc.cancelSlot(18)
    await expect(svc.lockSlot(18)).rejects.toThrow()
    await expect(svc.unlockSlot(18)).rejects.toThrow()
    await expect(svc.cancelSlot(18)).rejects.toThrow()
  })

  it('requestCancelSlot không thay đổi state — slot vẫn booked sau khi gửi', async () => {
    const before = await svc.getAll()
    const slotBefore = before.find((s) => s.id === 1)!
    expect(slotBefore.status).toBe('booked')

    await svc.requestCancelSlot(1, 'Lý do test đột xuất')

    const after = await svc.getAll()
    const slotAfter = after.find((s) => s.id === 1)!
    expect(slotAfter.status).toBe('booked')
    expect(slotAfter.benh_nhan_id).toBe(slotBefore.benh_nhan_id)
  })

  it('lock slot booked → throw, booked slot không bị ảnh hưởng', async () => {
    await expect(svc.lockSlot(1)).rejects.toThrow()
    const all = await svc.getAll()
    expect(all.find((s) => s.id === 1)?.status).toBe('booked')
  })

  it('state isolation: mỗi test bắt đầu từ 96 slots ban đầu', async () => {
    const slots = await svc.getAll()
    expect(slots.length).toBe(96)
    // Kiểm tra slot đặc trưng vẫn đúng trạng thái gốc
    expect(slots.find((s) => s.id === 1)?.status).toBe('booked')
    expect(slots.find((s) => s.id === 9)?.status).toBe('locked')
    expect(slots.find((s) => s.id === 16)?.status).toBe('cancelled')
  })
})
