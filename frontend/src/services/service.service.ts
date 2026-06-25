import { mockServices } from '@/mock/services'
import { mockSpecialties } from '@/mock/hospitals'
import type { ServiceItem, ServiceFormData, ServiceType, ServiceStatus } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let services = [...mockServices]
let idCounter = services.length + 1

function lookupSpecialtyTen(specialtyId: string | null | undefined): string | null {
  if (!specialtyId) return null
  return mockSpecialties.find(sp => String(sp.id) === specialtyId)?.ten ?? null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export const serviceService = {
  async getAll(
    loai?: ServiceType | '',
    search?: string,
    status?: ServiceStatus | '',
    page = 1,
    limit = 10,
  ): Promise<PagedResult<ServiceItem>> {
    await delay()
    let list = [...services]
    if (loai)   list = list.filter(s => s.loai === loai)
    if (status) list = list.filter(s => s.status === status)
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(s =>
        s.ten.toLowerCase().includes(q) ||
        s.ma_dich_vu.toLowerCase().includes(q) ||
        (s.mo_ta_ngan?.toLowerCase().includes(q) ?? false)
      )
    }
    const total      = list.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage   = Math.min(Math.max(1, page), totalPages)
    const items      = list.slice((safePage - 1) * limit, safePage * limit)
    return { items, total, page: safePage, totalPages }
    // Real API:
    // const params: Record<string, string | number> = { page, limit }
    // if (loai)   params.loai   = loai
    // if (status) params.status = status
    // if (search?.trim()) params.search = search.trim()
    // const res = await axiosInstance.get<ApiResponse<PagedResult<ServiceItem>>>('/admin/services', { params })
    // return res.data.data
  },

  async getById(id: string): Promise<ServiceItem> {
    await delay()
    const item = services.find(s => s.id === id)
    if (!item) throw new Error('Không tìm thấy dịch vụ')
    return { ...item }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<ServiceItem>>(`/admin/services/${id}`)
    // return res.data.data
  },

  async create(data: ServiceFormData): Promise<ServiceItem> {
    await delay()
    // Validate đồng bộ với backend
    if (!data.ten?.trim()) throw new Error('Tên dịch vụ là bắt buộc')
    if (!Number.isInteger(data.gia) || data.gia < 1) throw new Error('Giá phải là số nguyên lớn hơn 0')
    if (data.loai === 'related' && !data.specialty_id) throw new Error('Dịch vụ liên quan bắt buộc phải có chuyên khoa')
    if (data.loai === 'home' && (!data.khu_vuc || data.khu_vuc.length === 0))
      throw new Error('Dịch vụ tại nhà cần chọn ít nhất 1 khu vực phục vụ')

    const n = idCounter++
    const newItem: ServiceItem = {
      id:         `mock-svc-${String(n).padStart(3, '0')}`,
      ma_dich_vu: `DV${String(n).padStart(3, '0')}`,
      ...data,
      ten:          data.ten.trim(),
      specialty_ten: lookupSpecialtyTen(data.specialty_id),
      khu_vuc:       data.loai === 'home' ? (data.khu_vuc ?? []) : [],
      thoi_gian_phut: data.loai === 'home' ? 60 : 30,
      ngay_ap_dung:  'T2–T7',
      gio_bat_dau:   '08:00',
      gio_ket_thuc:  '17:00',
      chuan_bi_truoc: data.loai === 'related' ? (data.chuan_bi_truoc?.trim() || null) : null,
      status:    'active',
      so_bac_si: 0,
      so_luot_dat: 0,
      ngay_tao:       new Date().toISOString(),
      ngay_cap_nhat:  new Date().toISOString(),
      lich_su_thay_doi: [{
        id:             `log-new-${n}`,
        thoi_gian:      new Date().toISOString(),
        hanh_dong:      'tao_moi',
        nguoi_thay_doi: 'Admin',
        mo_ta:          'Tạo dịch vụ mới',
      }],
    }
    services = [newItem, ...services]
    return newItem
    // Real API:
    // const res = await axiosInstance.post<ApiResponse<ServiceItem>>('/admin/services', data)
    // return res.data.data
  },

  async update(id: string, data: ServiceFormData, mo_ta_thay_doi?: string): Promise<ServiceItem> {
    await delay()
    const idx = services.findIndex(s => s.id === id)
    if (idx === -1) throw new Error('Không tìm thấy dịch vụ')
    const updated: ServiceItem = {
      ...services[idx],
      ...data,
      ten:           data.ten.trim(),
      specialty_ten: lookupSpecialtyTen(data.specialty_id),
      khu_vuc:       data.loai === 'home' ? (data.khu_vuc ?? []) : [],
      thoi_gian_phut: data.loai === 'home' ? 60 : 30,
      ngay_ap_dung:  'T2–T7',
      gio_bat_dau:   '08:00',
      gio_ket_thuc:  '17:00',
      chuan_bi_truoc: data.loai === 'related' ? (data.chuan_bi_truoc?.trim() || null) : null,
      ngay_cap_nhat: new Date().toISOString(),
    }
    updated.lich_su_thay_doi = [
      {
        id:             `log-upd-${Date.now()}`,
        thoi_gian:      new Date().toISOString(),
        hanh_dong:      'cap_nhat',
        nguoi_thay_doi: 'Admin',
        mo_ta:          mo_ta_thay_doi?.trim() || `Cập nhật dịch vụ "${data.ten || services[idx].ten}"`,
      },
      ...(updated.lich_su_thay_doi ?? []),
    ]
    services[idx] = updated
    return { ...updated }
    // Real API:
    // const body = mo_ta_thay_doi?.trim() ? { ...data, mo_ta_thay_doi } : data
    // const res = await axiosInstance.put<ApiResponse<ServiceItem>>(`/admin/services/${id}`, body)
    // return res.data.data
  },

  async toggle(id: string): Promise<ServiceItem> {
    await delay()
    const item = services.find(s => s.id === id)
    if (!item) throw new Error('Không tìm thấy dịch vụ')
    item.status = item.status === 'active' ? 'inactive' : 'active'
    item.ngay_cap_nhat = new Date().toISOString()
    const action = item.status === 'inactive' ? 'an' : 'hien'
    item.lich_su_thay_doi = [
      {
        id:             `log-tog-${Date.now()}`,
        thoi_gian:      new Date().toISOString(),
        hanh_dong:      action,
        nguoi_thay_doi: 'Admin',
        mo_ta:          action === 'an' ? `Ẩn dịch vụ "${item.ten}"` : `Hiện dịch vụ "${item.ten}"`,
      },
      ...(item.lich_su_thay_doi ?? []),
    ]
    return { ...item }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<ServiceItem>>(`/admin/services/${id}/toggle`)
    // return res.data.data
  },
}
