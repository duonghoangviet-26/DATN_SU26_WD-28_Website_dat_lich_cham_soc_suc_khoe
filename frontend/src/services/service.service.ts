import axiosInstance from './axiosInstance'
import type { ServiceItem, ServiceFormData, ServiceType, ApiResponse } from '@/types'

export const serviceService = {

  /**
   * Lấy danh sách dịch vụ, có thể lọc theo loại và tìm kiếm theo tên.
   * GET /api/admin/services?loai=clinic&search=khám
   */
  async getAll(loai?: ServiceType | '', search?: string): Promise<ServiceItem[]> {
    const params: Record<string, string> = {}
    if (loai) params.loai = loai
    if (search?.trim()) params.search = search.trim()
    const res = await axiosInstance.get<ApiResponse<ServiceItem[]>>('/admin/services', { params })
    return res.data.data
  },

  /**
   * Lấy chi tiết 1 dịch vụ.
   * GET /api/admin/services/:id
   */
  async getById(id: string): Promise<ServiceItem> {
    const res = await axiosInstance.get<ApiResponse<ServiceItem>>(`/admin/services/${id}`)
    return res.data.data
  },

  /**
   * Tạo dịch vụ mới.
   * POST /api/admin/services — BE tự sinh ma_dich_vu, không truyền lên.
   */
  async create(data: ServiceFormData): Promise<ServiceItem> {
    const res = await axiosInstance.post<ApiResponse<ServiceItem>>('/admin/services', data)
    return res.data.data
  },

  /**
   * Cập nhật dịch vụ.
   * PUT /api/admin/services/:id
   * mo_ta_thay_doi chỉ gửi khi người dùng nhập — BE ghi vào audit log.
   */
  async update(id: string, data: ServiceFormData, mo_ta_thay_doi?: string): Promise<ServiceItem> {
    const body = mo_ta_thay_doi?.trim() ? { ...data, mo_ta_thay_doi } : data
    const res = await axiosInstance.put<ApiResponse<ServiceItem>>(`/admin/services/${id}`, body)
    return res.data.data
  },

  /**
   * Toggle ẩn / hiện dịch vụ.
   * PATCH /api/admin/services/:id/toggle
   * BE trả về full ServiceItem với status mới để FE cập nhật row trực tiếp.
   */
  async toggle(id: string): Promise<ServiceItem> {
    const res = await axiosInstance.patch<ApiResponse<ServiceItem>>(`/admin/services/${id}/toggle`)
    return res.data.data
  },
}
