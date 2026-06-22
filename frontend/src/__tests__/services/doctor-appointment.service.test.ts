/**
 * Test suite: doctor-appointment.service.ts
 *
 * Mỗi `describe` block dùng dynamic import sau vi.resetModules()
 * để đảm bảo module-level state (let appointments = [...]) được reset.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DoctorAppointmentDetail } from '@/types'

// ─── Helper: lấy service mới sau khi reset module ────────────────────────────

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
  })

  it('tab=past chỉ trả ngày quá khứ', async () => {
    const result = await svc.getAll({ tab: 'past' })
    expect(result.every((a) => a.ngay_kham < TODAY)).toBe(true)
  })

  it('tab=all trả tất cả 13 record', async () => {
    const result = await svc.getAll({ tab: 'all' })
    expect(result.length).toBe(13)
  })

  it('filter status=pending chỉ trả pending', async () => {
    const result = await svc.getAll({ tab: 'all', status: 'pending' })
    expect(result.every((a) => a.status === 'pending')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('kết hợp tab=today + status=confirmed', async () => {
    const result = await svc.getAll({ tab: 'today', status: 'confirmed' })
    expect(result.every((a) => a.ngay_kham === TODAY && a.status === 'confirmed')).toBe(true)
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
})

// ─── Nhóm: confirm() ─────────────────────────────────────────────────────────

describe('confirm() — xác nhận lịch hẹn', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-C01: pending+paid → status = confirmed', async () => {
    // id=11: pending + paid (mock)
    const updated = await svc.confirm(11)
    expect(updated.status).toBe('confirmed')
  })

  it('payment_status giữ nguyên sau confirm', async () => {
    const before = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 11)!
    const updated = await svc.confirm(11)
    expect(updated.payment_status).toBe(before.payment_status)
  })

  it('BUG-GUARD: confirm appointment không tồn tại → throw', async () => {
    await expect(svc.confirm(999)).rejects.toThrow()
  })

  it('BUG-GUARD: confirm đã confirmed → service phải từ chối', async () => {
    // id=1: đã confirmed → guard phải throw, không được "confirm lại"
    await expect(svc.confirm(1)).rejects.toThrow(/chỉ xác nhận.*chờ/i)
  })

  it('BUG-GUARD: confirm đã completed → service phải từ chối', async () => {
    // id=8: status=completed trong mock — sau fix phải throw
    // Hiện tại KHÔNG có guard → đây là BUG! Test sẽ FAIL sau khi fix đúng
    // Bật test này để xác nhận bug tồn tại, rồi fix service:
    await expect(svc.confirm(8)).rejects.toThrow(/chỉ xác nhận lịch.*chờ/i)
  })
})

// ─── Nhóm: reject() ───────────────────────────────────────────────────────────

describe('reject() — từ chối lịch hẹn', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-R01: pending+paid → cancelled + refunded', async () => {
    // id=11: pending+paid
    const updated = await svc.reject(11, 'Bác sĩ bận đột xuất')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('refunded')
    expect(updated.ly_do_huy).toBe('Bác sĩ bận đột xuất')
  })

  it('TC-R02: pending+unpaid → cancelled, payment_status KHÔNG đổi', async () => {
    // id=3: pending+unpaid
    const updated = await svc.reject(3, 'Lý do test')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('unpaid')
  })

  it('TC-R03: reject không tồn tại → throw', async () => {
    await expect(svc.reject(999, 'lý do')).rejects.toThrow()
  })

  it('BUG-GUARD: reject đã confirmed → service phải từ chối', async () => {
    // id=5: confirmed — reject() không nên hoạt động, phải dùng cancelConfirmed()
    await expect(svc.reject(5, 'lý do')).rejects.toThrow(/chỉ từ chối lịch.*chờ/i)
  })

  it('BUG-GUARD: reject đã cancelled → service phải từ chối', async () => {
    // id=10: cancelled — không reject lại
    await expect(svc.reject(10, 'lý do')).rejects.toThrow(/chỉ từ chối lịch.*chờ/i)
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

  it('TC-CO02: da_co_ket_qua KHÔNG được set true bởi complete()', async () => {
    const updated = await svc.complete(1)
    // BUG-1 fix: complete() chỉ đổi status, không set da_co_ket_qua
    expect(updated.da_co_ket_qua).toBe(true) // id=1 đã có kết quả trong mock
  })

  it('TC-CO02b: complete id=2 — da_co_ket_qua vẫn false', async () => {
    // id=2: confirmed, da_co_ket_qua=false
    const updated = await svc.complete(2)
    expect(updated.status).toBe('completed')
    expect(updated.da_co_ket_qua).toBe(false) // KHÔNG tự set true
  })

  it('complete không tồn tại → throw', async () => {
    await expect(svc.complete(999)).rejects.toThrow()
  })

  it('BUG-GUARD: complete pending → phải bị từ chối', async () => {
    // id=11: pending — không thể hoàn thành trực tiếp
    await expect(svc.complete(11)).rejects.toThrow(/chỉ hoàn thành lịch.*đã xác nhận/i)
  })

  it('BUG-GUARD: complete đã cancelled → phải bị từ chối', async () => {
    await expect(svc.complete(10)).rejects.toThrow(/chỉ hoàn thành lịch.*đã xác nhận/i)
  })
})

// ─── Nhóm: cancelConfirmed() ──────────────────────────────────────────────────

describe('cancelConfirmed() — bác sĩ hủy lịch đã xác nhận', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-CC01: confirmed+paid → cancelled+refunded', async () => {
    // id=5: confirmed+paid
    const updated = await svc.cancelConfirmed(5, 'Bác sĩ cấp cứu')
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('refunded')
    expect(updated.ly_do_huy).toBe('Bác sĩ cấp cứu')
  })

  it('TC-CC02: confirmed+unpaid → cancelled+refunded (100% bất kể)', async () => {
    // Giả sử có confirmed+unpaid (dù thực tế UI ngăn, backend vẫn phải xử lý đúng)
    // id=1: confirmed+paid, ta test refunded
    const updated = await svc.cancelConfirmed(1, 'Lý do')
    expect(updated.payment_status).toBe('refunded')
  })

  it('cancelConfirmed không tồn tại → throw', async () => {
    await expect(svc.cancelConfirmed(999, 'lý do')).rejects.toThrow()
  })

  it('BUG-GUARD: cancelConfirmed trên pending → phải từ chối', async () => {
    // cancelConfirmed chỉ dành cho confirmed
    await expect(svc.cancelConfirmed(11, 'lý do')).rejects.toThrow(/chỉ hủy lịch.*đã xác nhận/i)
  })
})

// ─── Nhóm: state machine tổng thể ────────────────────────────────────────────

describe('State machine: luồng chuyển trạng thái hợp lệ', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('pending → confirmed → completed (happy path)', async () => {
    await svc.confirm(11)
    const afterConfirm = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 11)
    expect(afterConfirm?.status).toBe('confirmed')

    await svc.complete(11)
    const afterComplete = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 11)
    expect(afterComplete?.status).toBe('completed')
    expect(afterComplete?.da_co_ket_qua).toBe(false) // vẫn false, chưa nhập kết quả
  })

  it('pending → cancelled via reject (happy path)', async () => {
    await svc.reject(11, 'Lý do')
    const after = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 11)
    expect(after?.status).toBe('cancelled')
    expect(after?.payment_status).toBe('refunded') // paid → refunded
  })

  it('confirmed → cancelled via cancelConfirmed (bác sĩ hủy)', async () => {
    // id=5: confirmed+paid
    await svc.cancelConfirmed(5, 'Lý do')
    const after = (await svc.getAll({ tab: 'all' })).find((a) => a.id === 5)
    expect(after?.status).toBe('cancelled')
    expect(after?.payment_status).toBe('refunded')
  })
})

// ─── Nhóm: edge cases mock data ───────────────────────────────────────────────

describe('Edge cases — dữ liệu mock', () => {
  let svc: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => { svc = await freshService() })

  it('TC-EDG09: id=12 (pending hết hạn) tồn tại trong all', async () => {
    const all = await svc.getAll({ tab: 'all' })
    const expired = all.find((a) => a.id === 12)
    expect(expired).toBeDefined()
    expect(expired!.status).toBe('pending')
    expect(expired!.ngay_kham < TODAY).toBe(true)
  })

  it('TC-EDG09: id=12 xuất hiện trong tab=past', async () => {
    const past = await svc.getAll({ tab: 'past' })
    expect(past.some((a) => a.id === 12)).toBe(true)
  })

  it('TC-CO03: id=13 completed+da_co_ket_qua=false', async () => {
    const all = await svc.getAll({ tab: 'all' })
    const noResult = all.find((a) => a.id === 13)
    expect(noResult?.status).toBe('completed')
    expect(noResult?.da_co_ket_qua).toBe(false)
  })

  it('id=11 pending+paid hôm nay tồn tại', async () => {
    const today = await svc.getAll({ tab: 'today' })
    const target = today.find((a) => a.id === 11)
    expect(target).toBeDefined()
    expect(target!.payment_status).toBe('paid')
    expect(target!.status).toBe('pending')
  })

  it('có ít nhất 1 pending+paid trong today → urgentCount > 0', async () => {
    const today = await svc.getAll({ tab: 'today', status: 'pending' })
    const paid = today.filter((a) => a.payment_status === 'paid')
    expect(paid.length).toBeGreaterThan(0)
  })
})
