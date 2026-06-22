/**
 * Test suite: examination.service.ts
 * B4 — Ghi kết quả khám & kê đơn thuốc
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/examination.service')
  return mod.examinationService
}

const DRUG = { ten_thuoc: 'Paracetamol 500mg', lieu_dung: '1 viên', tan_suat: '3 lần/ngày', so_ngay: 5, ghi_chu: '' }

// ─── getByAppointment() ───────────────────────────────────────────────────────

describe('getByAppointment()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('appointment_id=1 → trả kết quả hiện có', async () => {
    const result = await svc.getByAppointment(1)
    expect(result).not.toBeNull()
    expect(result!.appointment_id).toBe(1)
    expect(result!.chan_doan).toBeTruthy()
  })

  it('appointment_id=8 → có kết quả, co_the_sua=false', async () => {
    const result = await svc.getByAppointment(8)
    expect(result).not.toBeNull()
    expect(result!.co_the_sua).toBe(false)
  })

  it('appointment_id không tồn tại → null', async () => {
    const result = await svc.getByAppointment(999)
    expect(result).toBeNull()
  })

  it('appointment_id=2 (confirmed, chưa có kết quả) → null', async () => {
    // id=2 trong mock chưa có exam
    const result = await svc.getByAppointment(2)
    expect(result).toBeNull()
  })
})

// ─── save() — tạo mới ─────────────────────────────────────────────────────────

describe('save() — tạo kết quả mới', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('tạo kết quả cho appointment chưa có → trả ExaminationResult', async () => {
    const result = await svc.save({
      appointment_id: 2,
      chan_doan: 'Cao huyết áp độ 2',
      huong_dan_dieu_tri: 'Uống thuốc theo đơn',
      ngay_tai_kham: '2026-07-20',
      thuoc: [DRUG],
    })
    expect(result.appointment_id).toBe(2)
    expect(result.chan_doan).toBe('Cao huyết áp độ 2')
    expect(result.co_the_sua).toBe(true) // mới tạo → còn 24h sửa
    expect(result.thuoc).toHaveLength(1)
    expect(result.thuoc[0].ten_thuoc).toBe('Paracetamol 500mg')
  })

  it('tạo mới → đọc lại bằng getByAppointment', async () => {
    await svc.save({
      appointment_id: 5,
      chan_doan: 'Viêm phế quản',
      huong_dan_dieu_tri: 'Nghỉ ngơi',
      ngay_tai_kham: '',
      thuoc: [],
    })
    const fetched = await svc.getByAppointment(5)
    expect(fetched).not.toBeNull()
    expect(fetched!.chan_doan).toBe('Viêm phế quản')
  })

  it('thuốc được gán id tự động từ 1', async () => {
    const result = await svc.save({
      appointment_id: 7,
      chan_doan: 'Test',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [
        { ten_thuoc: 'Thuốc A', lieu_dung: '1v', tan_suat: '2l/n', so_ngay: 5, ghi_chu: '' },
        { ten_thuoc: 'Thuốc B', lieu_dung: '2v', tan_suat: '1l/n', so_ngay: 3, ghi_chu: '' },
      ],
    })
    expect(result.thuoc[0].id).toBe(1)
    expect(result.thuoc[1].id).toBe(2)
  })

  it('đơn thuốc rỗng → save thành công', async () => {
    const result = await svc.save({
      appointment_id: 6,
      chan_doan: 'Bình thường',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [],
    })
    expect(result.thuoc).toHaveLength(0)
  })

  it('ngay_tao được set tự động', async () => {
    const result = await svc.save({
      appointment_id: 2,
      chan_doan: 'Test',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [],
    })
    expect(result.ngay_tao).toBeTruthy()
    expect(new Date(result.ngay_tao).getFullYear()).toBe(new Date().getFullYear())
  })
})

// ─── save() — cập nhật ────────────────────────────────────────────────────────

describe('save() — cập nhật kết quả hiện có', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('appointment_id=9 (co_the_sua=false) → throw Kết quả đã bị khóa', async () => {
    // id=9 trong mock → appointment_id=9 (kiểm tra examination id=3)
    // appointment_id=9 trong examinations.ts là id=3, co_the_sua=false
    await expect(svc.save({
      appointment_id: 9,
      chan_doan: 'Cập nhật',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [],
    })).rejects.toThrow('Kết quả khám đã bị khóa (quá 24h)')
  })

  it('appointment_id=1 (co_the_sua=false) → throw', async () => {
    await expect(svc.save({
      appointment_id: 1,
      chan_doan: 'Override',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [],
    })).rejects.toThrow(/đã bị khóa/)
  })

  it('tạo mới rồi cập nhật (co_the_sua=true) → thành công', async () => {
    // Bước 1: tạo mới cho appointment_id=2
    await svc.save({
      appointment_id: 2,
      chan_doan: 'Lần đầu',
      huong_dan_dieu_tri: '',
      ngay_tai_kham: '',
      thuoc: [],
    })
    // Bước 2: cập nhật (co_the_sua=true vì mới tạo)
    const updated = await svc.save({
      appointment_id: 2,
      chan_doan: 'Cập nhật lần 2',
      huong_dan_dieu_tri: 'Mới',
      ngay_tai_kham: '2026-07-25',
      thuoc: [DRUG],
    })
    expect(updated.chan_doan).toBe('Cập nhật lần 2')
    expect(updated.thuoc).toHaveLength(1)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('save nhiều lần cho cùng appointment → mỗi lần id thuốc reset từ 1', async () => {
    // Tạo lần 1
    await svc.save({ appointment_id: 2, chan_doan: 'T1', huong_dan_dieu_tri: '', ngay_tai_kham: '', thuoc: [DRUG] })
    // Cập nhật lần 2 với 2 thuốc
    const r = await svc.save({
      appointment_id: 2, chan_doan: 'T2', huong_dan_dieu_tri: '', ngay_tai_kham: '',
      thuoc: [DRUG, { ...DRUG, ten_thuoc: 'Thuốc B' }],
    })
    expect(r.thuoc[0].id).toBe(1)
    expect(r.thuoc[1].id).toBe(2)
  })

  it('getByAppointment sau save trả đúng dữ liệu mới nhất', async () => {
    await svc.save({ appointment_id: 6, chan_doan: 'Ban đầu', huong_dan_dieu_tri: '', ngay_tai_kham: '', thuoc: [] })
    await svc.save({ appointment_id: 6, chan_doan: 'Cập nhật', huong_dan_dieu_tri: 'Mới', ngay_tai_kham: '', thuoc: [] })
    const fetched = await svc.getByAppointment(6)
    expect(fetched!.chan_doan).toBe('Cập nhật')
    expect(fetched!.huong_dan_dieu_tri).toBe('Mới')
  })
})
