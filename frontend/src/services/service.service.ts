import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse, ServiceItem, ServiceFormData, ServiceType, ServiceStatus } from '@/types'

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

interface PublicHomeServiceItem {
  id: string
  ten: string
  gia: number
  mo_ta?: string | null
  mo_ta_ngan?: string | null
  thoi_gian_phut?: number | null
  gio_dat_truoc_toi_thieu?: number | null
  khu_vuc?: string[]
  chuyen_khoa?: string | null
}

function getCurrentRole(): string | null {
  const storage = globalThis.localStorage
  if (!storage) return null

  try {
    const raw = storage.getItem('user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.role === 'string' ? parsed.role : null
  } catch {
    return null
  }
}

function isAdminContext(): boolean {
  return getCurrentRole() === 'admin'
}

function mapServiceItem(item: Partial<ServiceItem> & { id?: string; _id?: string }): ServiceItem {
  return {
    id: String(item.id ?? item._id ?? ''),
    ma_dich_vu: item.ma_dich_vu ?? '',
    ten: item.ten ?? '',
    loai: item.loai ?? 'home',
    gia: Number(item.gia ?? 0),
    mo_ta_ngan: item.mo_ta_ngan ?? null,
    mo_ta: item.mo_ta ?? null,
    thoi_gian_phut: item.thoi_gian_phut ?? null,
    gio_dat_truoc_toi_thieu: item.gio_dat_truoc_toi_thieu ?? undefined,
    ngay_ap_dung: item.ngay_ap_dung ?? null,
    gio_bat_dau: item.gio_bat_dau ?? null,
    gio_ket_thuc: item.gio_ket_thuc ?? null,
    chuan_bi_truoc: item.chuan_bi_truoc ?? null,
    specialty_id: item.specialty_id ?? null,
    specialty_ten: item.specialty_ten ?? null,
    la_goi: item.la_goi ?? false,
    doi_tuong_ap_dung: item.doi_tuong_ap_dung ?? null,
    khu_vuc: item.khu_vuc ?? [],
    so_bac_si: item.so_bac_si ?? 0,
    so_luot_dat: item.so_luot_dat ?? 0,
    active_appointments: item.active_appointments ?? 0,
    nguoi_tao: item.nguoi_tao ?? null,
    status: item.status ?? 'inactive',
    ngay_tao: item.ngay_tao,
    ngay_cap_nhat: item.ngay_cap_nhat,
    lich_su_thay_doi: item.lich_su_thay_doi ?? [],
  }
}

function mapPublicHomeService(item: PublicHomeServiceItem): ServiceItem {
  return mapServiceItem({
    id: item.id,
    ma_dich_vu: '',
    ten: item.ten,
    loai: 'home',
    gia: item.gia,
    mo_ta: item.mo_ta ?? null,
    mo_ta_ngan: item.mo_ta_ngan ?? null,
    thoi_gian_phut: item.thoi_gian_phut ?? null,
    gio_dat_truoc_toi_thieu: item.gio_dat_truoc_toi_thieu ?? undefined,
    ngay_ap_dung: 'T2-T7',
    gio_bat_dau: '08:00',
    gio_ket_thuc: '17:00',
    specialty_ten: item.chuyen_khoa ?? null,
    khu_vuc: item.khu_vuc ?? [],
    status: 'active',
  })
}

async function getPublicHomeServices(): Promise<ServiceItem[]> {
  const res = await axiosInstance.get<ApiResponse<PublicHomeServiceItem[]>>('/patient/booking/services')
  return (Array.isArray(res.data.data) ? res.data.data : []).map(mapPublicHomeService)
}

export const serviceService = {
  async getAll(
    loai?: ServiceType | '',
    search?: string,
    status?: ServiceStatus | '',
    page = 1,
    limit = 10,
    la_goi?: boolean | '',
  ): Promise<PagedResult<ServiceItem>> {
    if (!isAdminContext()) {
      const publicItems = await getPublicHomeServices()
      let filtered = publicItems

      if (loai) filtered = filtered.filter((item) => item.loai === loai)
      if (status) filtered = filtered.filter((item) => item.status === status)
      if (search?.trim()) {
        const keyword = search.trim().toLowerCase()
        filtered = filtered.filter((item) =>
          item.ten.toLowerCase().includes(keyword) ||
          (item.mo_ta_ngan?.toLowerCase().includes(keyword) ?? false)
        )
      }

      const total = filtered.length
      const totalPages = Math.max(1, Math.ceil(total / limit))
      const safePage = Math.min(Math.max(1, page), totalPages)
      const items = filtered.slice((safePage - 1) * limit, safePage * limit)

      return { items, total, page: safePage, totalPages }
    }

    const params: Record<string, string | number> = { page, limit }
    if (loai) params.loai = loai
    if (status) params.status = status
    if (search?.trim()) params.search = search.trim()
    if (la_goi !== '' && la_goi !== undefined) params.la_goi = la_goi ? 'true' : 'false'

    const res = await axiosInstance.get<ApiResponse<PagedResult<ServiceItem>>>('/admin/services', { params })
    const payload = res.data.data

    return {
      items: Array.isArray(payload?.items) ? payload.items.map(mapServiceItem) : [],
      total: Number(payload?.total ?? 0),
      page: Number(payload?.page ?? page),
      totalPages: Number(payload?.totalPages ?? 1),
    }
  },

  async getById(id: string): Promise<ServiceItem> {
    if (!isAdminContext()) {
      const items = await getPublicHomeServices()
      const item = items.find((service) => service.id === id)
      if (!item) throw new Error('Không tìm thấy dịch vụ')
      return item
    }

    const res = await axiosInstance.get<ApiResponse<ServiceItem>>(`/admin/services/${id}`)
    return mapServiceItem(res.data.data ?? {})
  },

  async create(data: ServiceFormData): Promise<ServiceItem> {
    const res = await axiosInstance.post<ApiResponse<ServiceItem>>('/admin/services', data)
    return mapServiceItem(res.data.data ?? {})
  },

  async update(id: string, data: ServiceFormData, mo_ta_thay_doi?: string): Promise<ServiceItem> {
    const body = mo_ta_thay_doi?.trim() ? { ...data, mo_ta_thay_doi } : data
    const res = await axiosInstance.put<ApiResponse<ServiceItem>>(`/admin/services/${id}`, body)
    return mapServiceItem(res.data.data ?? {})
  },

  async toggle(id: string): Promise<ServiceItem> {
    const res = await axiosInstance.patch<ApiResponse<ServiceItem>>(`/admin/services/${id}/toggle`)
    return mapServiceItem(res.data.data ?? {})
  },
}
