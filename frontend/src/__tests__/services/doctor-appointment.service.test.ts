/**
 * Test suite: doctor-appointment.service.ts
 *
 * Mỗi `describe` block dùng dynamic import sau vi.resetModules()
 * để đảm bảo module-level state (let appointments = [...]) được reset.
 *
 * Mock data (mock/doctor-appointments.ts) — 9 record, chỉ loai_kham='clinic'
 * (khám tại nhà tạm bỏ khỏi mock, làm sau khi xong chức năng chính):
 *   id=1: hôm nay 08:00, confirmed, paid, chưa có kết quả
 *   id=2: hôm nay 08:30, confirmed, paid, chưa có kết quả
 *   id=3: hôm nay 09:00, confirmed, paid, chưa có kết quả
 *   id=4: ngày mai 08:00, confirmed, paid
 *   id=5: ngày mai 08:30, confirmed, paid
 *   id=6: +2 ngày 08:00, confirmed, paid
 *   id=7: hôm qua, completed, paid, đã có kết quả
 *   id=8: -2 ngày, completed, paid, đã có kết quả
 *   id=9: -3 ngày, cancelled, refunded (lịch sử)
 *
 * Clinic luôn auto-confirm khi thanh toán (quyết định 2026-07-02) nên mock không còn
 * record nào ở trạng thái 'pending' — các test guard liên quan pending/unpaid (chỉ có ý
 * nghĩa khi có khám tại nhà) tự dựng precondition bằng cách mutate object trả về từ
 * getAll() (getAll() chỉ shallow-copy mảng, item bên trong vẫn cùng reference với state
 * nội bộ service — mutate object đó tương đương mutate state thật). Cách này giữ được
 * toàn bộ coverage của state machine mà không cần dữ liệu demo giả home/pending cố định.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/doctor-appointment.service')
  return mod.doctorAppointmentService
}

const TODAY = new Date().toISOString().slice(0, 10)
const d = (n: number) => {
  const date = new Date()
  date.setDate(date.getDate() + n)
  return date.toISOString().slice(0, 10)
}

// ─── Nhóm: getAll() ───────────────────────────────────────────────────────────

describe('getAll() — filter theo tab', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('tab=today chỉ trả ngày hôm nay', async () => {
    const result = await svc.getAll({ tab: 'today' })
    expect(result.every((a) => a.ngay_kham === TODAY)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('tab=upcoming chỉ trả ngày tương lai', async () => {
    const result = await svc.getAll({ tab: 'upcoming' })
    expect(result.every((a) => a.ngay_kham > TODAY)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('tab=past chỉ trả ngày quá khứ', async () => {
    const result = await svc.getAll({ tab: 'past' })
    expect(result.every((a) => a.ngay_kham < TODAY)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('tab=all trả tất cả 9 record', async () => {
    const result = await svc.getAll({ tab: 'all' })
    expect(result.length).toBe(9)
  })

  it('filter status=confirmed chỉ trả confirmed', async () => {
    const result = await svc.getAll({ tab: 'all', status: 'confirmed' })
    expect(result.every((a) => a.status === 'confirmed')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('kết hợp tab=today + status=confirmed', async () => {
    const result = await svc.getAll({ tab: 'today', status: 'confirmed' })
    expect(result.every((a) => a.ngay_kham === TODAY && a.status === 'confirmed')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('kết quả được sắp xếp theo ngày_kham tăng dần', async () => {
    const result = await svc.getAll({ tab: 'all' })
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]
      const curr = result[i]
      const cmp = prev.ngay_kham.localeCompare(curr.ngay_kham) ||
                  prev.gio_kham.localeCompare(curr.gio_kham)
      expect(cmp).toBeLessThanOrEqual(0)
    }
  })

  it('quyết định 2026-07-04: pending+unpaid bị ẩn hẳn khỏi mọi tab', async () => {
    // Dựng precondition: lấy 1 confirmed có sẵn (id=1) rồi mutate thành pending+unpaid —
    // getAll() không deep-clone nên mutate item trả về = mutate state nội bộ.
    const before = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    before.status = 'pending'
    before.payment_status = 'unpaid'

    const after = await svc.getAll({ tab: 'all' })
    expect(after.some((a) => a.id === 1)).toBe(false)
  })
})

// ─── Nhóm: confirm() ─────────────────────────────────────────────────────────
// confirm()/reject() chỉ có ý nghĩa thật với lịch pending (home) — clinic luôn
// auto-confirm nên mock hiện không có sẵn record pending. Test dựng precondition
// bằng cách mutate 1 record confirmed có sẵn thành pending trước khi gọi.

describe('confirm() — xác nhận lịch hẹn', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-C01: pending+paid → status = confirmed', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    const updated = await svc.confirm(1)
    expect(updated.status).toBe('confirmed')
  })

  it('payment_status giữ nguyên sau confirm', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    const updated = await svc.confirm(1)
    expect(updated.payment_status).toBe('paid')
  })

  it('BUG-GUARD: confirm appointment không tồn tại → throw', async () => {
    await expect(svc.confirm(999)).rejects.toThrow()
  })

  it('BUG-GUARD: confirm đã confirmed → service phải từ chối', async () => {
    // id=1: đã confirmed → guard phải throw, không được "confirm lại"
    await expect(svc.confirm(1)).rejects.toThrow(/chỉ xác nhận.*chờ/i)
  })

  it('BUG-GUARD: confirm đã completed → service phải từ chối', async () => {
    // id=7: status=completed trong mock
    await expect(svc.confirm(7)).rejects.toThrow(/chỉ xác nhận lịch.*chờ/i)
  })

  it('quyết định 2026-07-04: pending+unpaid → service phải từ chối', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    item.payment_status = 'unpaid'
    await expect(svc.confirm(1)).rejects.toThrow(/chỉ xác nhận lịch hẹn đã thanh toán/i)
  })
})

// ─── Nhóm: reject() ───────────────────────────────────────────────────────────

describe('reject() — từ chối lịch hẹn', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-R01: pending+paid → cancelled + refunded', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    const updated = await svc.reject(1, 'Bác sĩ bận đột xuất')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('refunded')
    expect(updated.ly_do_huy).toBe('Bác sĩ bận đột xuất')
  })

  it('TC-R03: reject không tồn tại → throw', async () => {
    await expect(svc.reject(999, 'lý do')).rejects.toThrow()
  })

  it('BUG-GUARD: reject đã confirmed → service phải từ chối', async () => {
    // id=1: confirmed — reject() không nên hoạt động, phải dùng cancelConfirmed()
    await expect(svc.reject(1, 'lý do')).rejects.toThrow(/chỉ từ chối lịch.*chờ/i)
  })

  it('BUG-GUARD: reject đã cancelled → service phải từ chối', async () => {
    // id=9: cancelled — không reject lại
    await expect(svc.reject(9, 'lý do')).rejects.toThrow(/chỉ từ chối lịch.*chờ/i)
  })
})

// ─── Nhóm: complete() ─────────────────────────────────────────────────────────

describe('complete() — đánh dấu hoàn thành', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-CO01: confirmed → completed', async () => {
    // id=1: confirmed
    const updated = await svc.complete(1)
    expect(updated.status).toBe('completed')
  })

  it('TC-CO02: complete() không tự set da_co_ket_qua=true — giữ nguyên giá trị cũ', async () => {
    // id=1: confirmed, da_co_ket_qua=false trong mock
    const updated = await svc.complete(1)
    expect(updated.da_co_ket_qua).toBe(false)
  })

  it('complete không tồn tại → throw', async () => {
    await expect(svc.complete(999)).rejects.toThrow()
  })

  it('BUG-GUARD: complete pending → phải bị từ chối', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    await expect(svc.complete(1)).rejects.toThrow(/chỉ hoàn thành lịch.*đã xác nhận/i)
  })

  it('BUG-GUARD: complete đã cancelled → phải bị từ chối', async () => {
    await expect(svc.complete(9)).rejects.toThrow(/chỉ hoàn thành lịch.*đã xác nhận/i)
  })
})

// ─── Nhóm: cancelConfirmed() ──────────────────────────────────────────────────

describe('cancelConfirmed() — bác sĩ hủy lịch đã xác nhận', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  // Pin Date.now() (KHÔNG dùng fake timers — delay() trong service dùng setTimeout thật,
  // fake timers sẽ treo promise vĩnh viễn). Giữa ngày để id=1 (hôm nay) và id=4 (ngày mai)
  // đều nằm trong 24h emergency-cancel window một cách xác định, không phụ thuộc giờ chạy
  // test thật (tránh flaky nếu chạy gần nửa đêm).
  beforeEach(async () => {
    svc = await freshService()
    vi.spyOn(Date, 'now').mockReturnValue(new Date(`${TODAY}T10:00:00Z`).getTime())
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('TC-CC01: confirmed+paid → cancelled+refunded', async () => {
    // id=1: confirmed+paid, hôm nay — trong 24h window
    const updated = await svc.cancelConfirmed(1, 'Bác sĩ cấp cứu')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('refunded')
    expect(updated.ly_do_huy).toBe('Bác sĩ cấp cứu')
  })

  it('quyết định 2026-07-04: confirmed+unpaid → cancelled, payment_status giữ unpaid (không hoàn tiền)', async () => {
    // Dựng precondition: id=1 confirmed+paid → mutate unpaid rồi hủy
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.payment_status = 'unpaid'

    const updated = await svc.cancelConfirmed(1, 'Bác sĩ bận đột xuất')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('unpaid')
    expect(updated.payment_deadline).toBeNull()
  })

  it('cancelConfirmed không tồn tại → throw', async () => {
    await expect(svc.cancelConfirmed(999, 'lý do')).rejects.toThrow()
  })

  it('BUG-GUARD: cancelConfirmed trên pending → phải từ chối', async () => {
    // cancelConfirmed chỉ dành cho confirmed
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'
    await expect(svc.cancelConfirmed(1, 'lý do')).rejects.toThrow(/chỉ hủy lịch.*đã xác nhận/i)
  })

  it('quyết định 2026-07-04: clinic confirmed còn hơn 24h → từ chối, phải dùng Yêu cầu hủy', async () => {
    // id=6: clinic, confirmed, +2 ngày — chắc chắn ngoài 24h bất kể giờ chạy test
    await expect(svc.cancelConfirmed(6, 'Bác sĩ bận')).rejects.toThrow(/Yêu cầu hủy/i)
  })

  it('24h window chỉ áp dụng cho clinic — home còn hơn 24h vẫn hủy được ngay', async () => {
    // Dựng precondition: id=6 (clinic, +2 ngày) → mutate loai_kham='home' để test guard
    // bỏ qua ràng buộc 24h khi không phải clinic (home không dùng slot system).
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 6)!
    item.loai_kham = 'home'
    const updated = await svc.cancelConfirmed(6, 'Bác sĩ bận')
    expect(updated.status).toBe('cancelled')
  })
})

// ─── Nhóm: state machine tổng thể ────────────────────────────────────────────

describe('State machine: luồng chuyển trạng thái hợp lệ', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('pending → confirmed → completed (happy path)', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'

    await svc.confirm(1)
    const afterConfirm = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)
    expect(afterConfirm?.status).toBe('confirmed')

    await svc.complete(1)
    const afterComplete = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)
    expect(afterComplete?.status).toBe('completed')
    expect(afterComplete?.da_co_ket_qua).toBe(false) // vẫn false, chưa nhập kết quả
  })

  it('pending → cancelled via reject (happy path)', async () => {
    const item = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)!
    item.status = 'pending'

    await svc.reject(1, 'Lý do')
    const after = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)
    expect(after?.status).toBe('cancelled')
    expect(after?.payment_status).toBe('refunded') // paid → refunded
  })

  it('confirmed → cancelled via cancelConfirmed (bác sĩ hủy)', async () => {
    // id=1: confirmed+paid, hôm nay — pin Date.now() để nằm trong 24h emergency window
    const spy = vi.spyOn(Date, 'now').mockReturnValue(new Date(`${TODAY}T10:00:00Z`).getTime())
    try {
      await svc.cancelConfirmed(1, 'Lý do')
    } finally {
      spy.mockRestore()
    }
    const after = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 1)
    expect(after?.status).toBe('cancelled')
    expect(after?.payment_status).toBe('refunded')
  })
})

// ─── Nhóm: edge cases mock data ───────────────────────────────────────────────

describe('Edge cases — dữ liệu mock', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('id=9 (cancelled+refunded, -3 ngày) tồn tại trong all và tab=past', async () => {
    const all = await svc.getAll({ tab: 'all' })
    const cancelled = all.find((a) => a.id === 9)
    expect(cancelled).toBeDefined()
    expect(cancelled!.status).toBe('cancelled')
    expect(cancelled!.payment_status).toBe('refunded')

    const past = await svc.getAll({ tab: 'past' })
    expect(past.some((a) => a.id === 9)).toBe(true)
  })

  it('id=7, id=8 (completed) đều đã có kết quả khám', async () => {
    const all = await svc.getAll({ tab: 'all' })
    expect(all.find((a) => a.id === 7)?.da_co_ket_qua).toBe(true)
    expect(all.find((a) => a.id === 8)?.da_co_ket_qua).toBe(true)
  })

  it('mock chỉ toàn loai_kham=clinic (khám tại nhà tạm bỏ, làm sau)', async () => {
    const all = await svc.getAll({ tab: 'all' })
    expect(all.every((a) => a.loai_kham === 'clinic')).toBe(true)
  })

  it('không còn appointment nào ở trạng thái pending — clinic luôn auto-confirm khi đặt', async () => {
    const all = await svc.getAll({ tab: 'all' })
    expect(all.some((a) => a.status === 'pending')).toBe(false)
  })

  it('có ít nhất 2 lịch confirmed hôm nay', async () => {
    const today = await svc.getAll({ tab: 'today', status: 'confirmed' })
    expect(today.length).toBeGreaterThanOrEqual(2)
  })
})
