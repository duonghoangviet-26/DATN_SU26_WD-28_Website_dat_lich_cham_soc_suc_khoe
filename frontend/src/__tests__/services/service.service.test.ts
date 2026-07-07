import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { serviceService } from '@/services/service.service'

const mockedGet = vi.mocked(axiosInstance.get)
const mockedPost = vi.mocked(axiosInstance.post)
const mockedPut = vi.mocked(axiosInstance.put)
const mockedPatch = vi.mocked(axiosInstance.patch)

function mockLocalStorage(role: string | null) {
  const store = new Map<string, string>()
  if (role) {
    store.set('user', JSON.stringify({ role }))
  }

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  })
}

describe('serviceService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedPut.mockReset()
    mockedPatch.mockReset()
    vi.unstubAllGlobals()
  })

  it('getAll() uses admin services API in admin context', async () => {
    mockLocalStorage('admin')
    mockedGet.mockResolvedValue({
      data: {
        data: {
          items: [{ id: 'svc-1', ma_dich_vu: 'DV001', ten: 'Xet nghiem A', loai: 'home', gia: 200000, status: 'active' }],
          total: 1,
          page: 1,
          totalPages: 1,
        },
      },
    } as never)

    const result = await serviceService.getAll('home', 'xet', 'active', 1, 10)

    expect(mockedGet).toHaveBeenCalledWith('/admin/services', {
      params: { page: 1, limit: 10, loai: 'home', status: 'active', search: 'xet' },
    })
    expect(result.items[0].id).toBe('svc-1')
    expect(result.total).toBe(1)
  })

  it('getAll() uses public booking services outside admin context', async () => {
    mockLocalStorage(null)
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: 'svc-home-1', ten: 'Lay mau tai nha', gia: 500000, mo_ta_ngan: 'Mo ta', khu_vuc: ['Cau Giay'] },
        ],
      },
    } as never)

    const result = await serviceService.getAll('home', '', 'active', 1, 10)

    expect(mockedGet).toHaveBeenCalledWith('/patient/booking/services')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].status).toBe('active')
    expect(result.items[0].loai).toBe('home')
  })

  it('getById() uses admin detail API in admin context', async () => {
    mockLocalStorage('admin')
    mockedGet.mockResolvedValue({
      data: {
        data: { id: 'svc-2', ma_dich_vu: 'DV002', ten: 'Sieu am', loai: 'related', gia: 350000, status: 'inactive' },
      },
    } as never)

    const item = await serviceService.getById('svc-2')

    expect(mockedGet).toHaveBeenCalledWith('/admin/services/svc-2')
    expect(item.id).toBe('svc-2')
    expect(item.status).toBe('inactive')
  })

  it('getById() finds public home service outside admin context', async () => {
    mockLocalStorage('user')
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: 'svc-home-2', ten: 'Lay mau B', gia: 250000, mo_ta: 'Chi tiet' },
        ],
      },
    } as never)

    const item = await serviceService.getById('svc-home-2')

    expect(mockedGet).toHaveBeenCalledWith('/patient/booking/services')
    expect(item.id).toBe('svc-home-2')
    expect(item.loai).toBe('home')
  })

  it('create/update/toggle() call real admin CRUD endpoints', async () => {
    mockLocalStorage('admin')
    mockedPost.mockResolvedValue({ data: { data: { id: 'svc-3', ten: 'Moi', loai: 'home', gia: 100000, status: 'inactive' } } } as never)
    mockedPut.mockResolvedValue({ data: { data: { id: 'svc-3', ten: 'Moi cap nhat', loai: 'home', gia: 120000, status: 'inactive' } } } as never)
    mockedPatch.mockResolvedValue({ data: { data: { id: 'svc-3', ten: 'Moi cap nhat', loai: 'home', gia: 120000, status: 'active' } } } as never)

    await serviceService.create({ ten: 'Moi', loai: 'home', gia: 100000, khu_vuc: ['Cau Giay'] })
    await serviceService.update('svc-3', { ten: 'Moi cap nhat', loai: 'home', gia: 120000, khu_vuc: ['Cau Giay'] }, 'Cap nhat')
    const toggled = await serviceService.toggle('svc-3')

    expect(mockedPost).toHaveBeenCalledWith('/admin/services', { ten: 'Moi', loai: 'home', gia: 100000, khu_vuc: ['Cau Giay'] })
    expect(mockedPut).toHaveBeenCalledWith('/admin/services/svc-3', {
      ten: 'Moi cap nhat',
      loai: 'home',
      gia: 120000,
      khu_vuc: ['Cau Giay'],
      mo_ta_thay_doi: 'Cap nhat',
    })
    expect(mockedPatch).toHaveBeenCalledWith('/admin/services/svc-3/toggle')
    expect(toggled.status).toBe('active')
  })
})
