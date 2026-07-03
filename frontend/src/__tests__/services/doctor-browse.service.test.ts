import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/doctor.service')
  return mod.doctorService
}

describe('getBySpecialtySlug()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('trả về đúng bác sĩ approved theo chuyên khoa', async () => {
    const docs = await svc.getBySpecialtySlug('tim-mach')
    expect(docs.length).toBe(1)
    expect(docs[0].ho_ten).toBe('BS. Lê Hoàng Cường')
  })

  it('không trả bác sĩ pending', async () => {
    const docs = await svc.getBySpecialtySlug('da-lieu') // Đỗ Minh Khoa pending
    expect(docs.length).toBe(0)
  })

  it('không trả bác sĩ suspended', async () => {
    const docs = await svc.getBySpecialtySlug('than-kinh') // Vũ Thị Lan suspended
    expect(docs.length).toBe(0)
  })

  it('slug không tồn tại → mảng rỗng', async () => {
    const docs = await svc.getBySpecialtySlug('khong-ton-tai')
    expect(docs).toEqual([])
  })

  it('slug thuộc chuyên khoa hidden → mảng rỗng', async () => {
    const docs = await svc.getBySpecialtySlug('tai-mui-hong')
    expect(docs).toEqual([])
  })
})
