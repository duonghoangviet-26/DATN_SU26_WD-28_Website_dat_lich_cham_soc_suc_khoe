import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/specialty.service')
  return mod.specialtyService
}

describe('getAllActive()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('không trả về chuyên khoa status=hidden (Tai Mũi Họng)', async () => {
    const list = await svc.getAllActive()
    expect(list.some((s) => s.slug === 'tai-mui-hong')).toBe(false)
  })

  it('mỗi item có slug khớp mock', async () => {
    const list = await svc.getAllActive()
    expect(list.find((s) => s.ten === 'Tim mạch')?.slug).toBe('tim-mach')
  })

  it('so_bac_si đếm đúng bác sĩ approved theo chuyên khoa Tim mạch', async () => {
    const list = await svc.getAllActive()
    const timMach = list.find((s) => s.slug === 'tim-mach')
    expect(timMach?.so_bac_si).toBe(1) // chỉ BS Lê Hoàng Cường approved
  })

  it('sắp xếp theo thu_tu tăng dần — Tim mạch trước Nhi khoa', async () => {
    const list = await svc.getAllActive()
    expect(list[0].slug).toBe('tim-mach')
    expect(list[1].slug).toBe('nhi-khoa')
  })
})

describe('getBySlug()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('slug tồn tại + active → trả về đúng chuyên khoa', async () => {
    const sp = await svc.getBySlug('tim-mach')
    expect(sp?.ten).toBe('Tim mạch')
  })

  it('slug thuộc chuyên khoa hidden → trả về null', async () => {
    const sp = await svc.getBySlug('tai-mui-hong')
    expect(sp).toBeNull()
  })

  it('slug không tồn tại → trả về null', async () => {
    const sp = await svc.getBySlug('khong-ton-tai')
    expect(sp).toBeNull()
  })
})
