import axiosInstance from './axiosInstance'

// Mẫu đăng ký ca làm việc của bác sĩ.
// Nghiệp vụ: .claude/rules/lich-lam-viec-bac-si.md mục 3 — bác sĩ KHÔNG full-time, họ
// đăng ký theo CA. Bảng này là nguồn để hệ thống sinh lịch làm việc; ca không có ai
// đăng ký thì ngày đó không mở đặt lịch online.

export interface ScheduleTemplate {
  id: string
  bac_si_id: string
  bac_si_ten: string | null
  thu_trong_tuan: number
  thu_ten: string | null
  ca: 'sang' | 'chieu'
  ca_ten: string
  phong_id: string
  phong_ten: string | null
  chuyen_khoa_id: string | null
  chuyen_khoa_ten: string | null
  trang_thai: 'active' | 'inactive'
  hieu_luc_tu: string
  hieu_luc_den: string | null
  ghi_chu: string | null
}

export interface ScheduleTemplateGridRow {
  thu_trong_tuan: number
  thu_ten: string
  sang: ScheduleTemplate[]
  chieu: ScheduleTemplate[]
}

export interface ScheduleTemplateGrid {
  luoi: ScheduleTemplateGridRow[]
  chua_xep_ca: { id: string; ho_ten: string | null }[]
  bac_si: { id: string; ho_ten: string | null }[]
  phong: { id: string; ten: string }[]
}

export interface ScheduleTemplatePayload {
  bac_si_id: string
  thu_trong_tuan: number
  ca: 'sang' | 'chieu'
  phong_id: string
  chuyen_khoa_id?: string | null
  hieu_luc_tu?: string
  hieu_luc_den?: string | null
  ghi_chu?: string | null
}

export const scheduleTemplateService = {
  async getGrid(): Promise<ScheduleTemplateGrid> {
    const res = await axiosInstance.get('/admin/schedule-templates/grid')
    return res.data.data
  },

  async create(payload: ScheduleTemplatePayload): Promise<ScheduleTemplate> {
    const res = await axiosInstance.post('/admin/schedule-templates', payload)
    return res.data.data
  },

  async createMany(payload: {
    bac_si_id: string
    phong_id: string
    chuyen_khoa_id?: string | null
    hieu_luc_tu?: string
    hieu_luc_den?: string | null
    cac_ca: { thu_trong_tuan: number; ca: 'sang' | 'chieu' }[]
  }): Promise<ScheduleTemplate[]> {
    const res = await axiosInstance.post('/admin/schedule-templates/bulk', payload)
    return res.data.data
  },

  async remove(id: string): Promise<{ id: string; trang_thai: string }> {
    const res = await axiosInstance.delete(`/admin/schedule-templates/${id}`)
    return res.data.data
  },
}
