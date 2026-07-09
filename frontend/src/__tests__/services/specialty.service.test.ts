import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}))

import axiosInstance from '@/services/axiosInstance'
import { specialtyService } from '@/services/specialty.service'

const mockedGet = vi.mocked(axiosInstance.get)

const publicSpecialties = [
  { id: 'sp-1', ten: 'Tim mach', mo_ta: 'Mo ta tim mach', icon_url: 'TM', slug: 'tim-mach' },
  { id: 'sp-2', ten: 'Nhi khoa', mo_ta: 'Mo ta nhi khoa', icon_url: 'NK', slug: 'nhi-khoa' },
]

function mockSpecialtyApis() {
  mockedGet.mockImplementation((url, config) => {
    if (url === '/admin/specialties') {
      expect(config?.params).toEqual({ status: 'active' })
      return Promise.resolve({
        data: {
          data: [
            { _id: 'sp-1', ten: 'Tim mach' },
            { _id: 'sp-2', ten: 'Nhi khoa' },
          ],
        },
      })
    }

    if (url === '/patient/booking/specialties') {
      return Promise.resolve({
        data: {
          data: publicSpecialties,
        },
      })
    }

    if (url === '/patient/booking/doctors') {
      const specialtyId = config?.params?.specialty_id
      const doctorsBySpecialty: Record<string, unknown[]> = {
        'sp-1': [{ id: 'doc-1' }],
        'sp-2': [{ id: 'doc-2' }, { id: 'doc-3' }],
      }

      return Promise.resolve({
        data: {
          data: doctorsBySpecialty[String(specialtyId)] ?? [],
        },
      })
    }

    return Promise.reject(new Error(`Unexpected GET ${String(url)}`))
  })
}

describe('specialtyService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockSpecialtyApis()
  })

  it('getAll() maps active admin specialties from real API', async () => {
    const list = await specialtyService.getAll()

    expect(list).toEqual([
      { id: 'sp-1', ten: 'Tim mach' },
      { id: 'sp-2', ten: 'Nhi khoa' },
    ])
  })

  it('getAllActive() reads public specialties and computes doctor counts', async () => {
    const list = await specialtyService.getAllActive()

    expect(list).toEqual([
      {
        id: 'sp-1',
        ten: 'Tim mach',
        mo_ta: 'Mo ta tim mach',
        icon_url: 'TM',
        slug: 'tim-mach',
        so_bac_si: 1,
      },
      {
        id: 'sp-2',
        ten: 'Nhi khoa',
        mo_ta: 'Mo ta nhi khoa',
        icon_url: 'NK',
        slug: 'nhi-khoa',
        so_bac_si: 2,
      },
    ])
  })

  it('getBySlug() returns the matching specialty with live doctor count', async () => {
    const specialty = await specialtyService.getBySlug('tim-mach')

    expect(specialty).toEqual({
      id: 'sp-1',
      ten: 'Tim mach',
      mo_ta: 'Mo ta tim mach',
      icon_url: 'TM',
      slug: 'tim-mach',
      so_bac_si: 1,
    })
  })

  it('getBySlug() returns null for an unknown slug', async () => {
    const specialty = await specialtyService.getBySlug('khong-ton-tai')

    expect(specialty).toBeNull()
  })
})
