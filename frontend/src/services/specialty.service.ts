import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface SpecialtyOption {
  id: string
  ten: string
}

export interface SpecialtyBrowseItem {
  id: string
  ten: string
  mo_ta: string
  icon_url: string
  slug: string
  so_bac_si: number
}

interface SpecialtyApiItem {
  id?: string
  _id?: string
  ten: string
  mo_ta?: string | null
  icon_url?: string | null
  slug: string
}

function normalizeId(item: SpecialtyApiItem): string {
  return String(item.id ?? item._id ?? '')
}

function toBrowseItem(item: SpecialtyApiItem, so_bac_si: number): SpecialtyBrowseItem {
  return {
    id: normalizeId(item),
    ten: item.ten,
    mo_ta: item.mo_ta ?? '',
    icon_url: item.icon_url ?? '',
    slug: item.slug,
    so_bac_si,
  }
}

async function getApprovedDoctorCountBySpecialty(specialtyId: string): Promise<number> {
  const res = await axiosInstance.get<ApiResponse<unknown[]>>('/patient/booking/doctors', {
    params: { specialty_id: specialtyId },
  })
  return Array.isArray(res.data.data) ? res.data.data.length : 0
}

async function getPublicSpecialties(): Promise<SpecialtyApiItem[]> {
  const res = await axiosInstance.get<ApiResponse<SpecialtyApiItem[]>>('/patient/booking/specialties')
  return Array.isArray(res.data.data) ? res.data.data : []
}

export const specialtyService = {
  async getAll(): Promise<SpecialtyOption[]> {
    const res = await axiosInstance.get<ApiResponse<SpecialtyApiItem[]>>('/admin/specialties', {
      params: { status: 'active' },
    })

    return (Array.isArray(res.data.data) ? res.data.data : []).map((item) => ({
      id: normalizeId(item),
      ten: item.ten,
    }))
  },

  async getAllActive(): Promise<SpecialtyBrowseItem[]> {
    const specialties = await getPublicSpecialties()
    const counts = await Promise.all(
      specialties.map((item) => getApprovedDoctorCountBySpecialty(normalizeId(item)))
    )

    return specialties.map((item, index) => toBrowseItem(item, counts[index] ?? 0))
  },

  async getBySlug(slug: string): Promise<SpecialtyBrowseItem | null> {
    const specialties = await getPublicSpecialties()
    const found = specialties.find((item) => item.slug === slug)
    if (!found) return null

    const so_bac_si = await getApprovedDoctorCountBySpecialty(normalizeId(found))
    return toBrowseItem(found, so_bac_si)
  },
}
