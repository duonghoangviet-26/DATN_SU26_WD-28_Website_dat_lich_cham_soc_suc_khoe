import axios from './axiosInstance'

export interface AdminPatientMember {
  id: string
  ho_ten: string
  ngay_sinh?: string | null
  gioi_tinh?: 'nam' | 'nu' | 'khac' | null
  quan_he?: string | null
  nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
  di_ung?: string | null
  benh_nen?: string | null
  la_chu_ho: boolean
  ngay_xoa?: string | null
}

export interface AdminPatient {
  id: string
  email: string
  ho_ten: string
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null
  role: 'user' | 'patient'
  status: 'active' | 'locked'
  ngay_xoa?: string | null
  ngay_tao?: string | null
  ngay_cap_nhat?: string | null
  primary_member?: AdminPatientMember | null
  family_members?: AdminPatientMember[]
  family_member_count: number
  appointment_count: number
  medical_record_count: number
  last_exam_at?: string | null
}

export interface AdminPatientPrescriptionItem {
  id: string
  ten_thuoc: string
  lieu_luong?: string | null
  tan_suat?: string | null
  gio_uong: string[]
  so_ngay: number
  ghi_chu?: string | null
}

export interface AdminPatientPrescription {
  id: string
  ghi_chu?: string | null
  nguon: string
  ngay_tao?: string | null
  items: AdminPatientPrescriptionItem[]
}

export interface AdminPatientExamHistory {
  id: string
  appointment_id?: string | null
  queue_id?: string | null
  ma_lich_hen?: string | null
  benh_nhan: string
  ngay_kham?: string | null
  gio_kham?: string | null
  bac_si_id?: string | null
  bac_si?: string | null
  chuyen_khoa?: string | null
  phong_kham?: string | null
  chan_doan: string
  huong_dan_dieu_tri?: string | null
  ghi_chu?: string | null
  status: string
  don_thuoc: AdminPatientPrescription[]
  hinh_anh_noi_soi?: Array<{
    url: string
    mo_ta?: string | null
    uploaded_at?: string | null
  }>
}

export interface AdminPatientAuditLog {
  _id: string
  nguoi_thuc_hien_id?: {
    ho_ten?: string
    email?: string
    anh_dai_dien?: string | null
  } | null
  vai_tro: string
  hanh_dong: string
  loai_doi_tuong: string
  du_lieu_cu?: Record<string, unknown> | null
  du_lieu_moi?: Record<string, unknown> | null
  ly_do?: string | null
  ngay_tao: string
}

export interface AdminPatientListResponse {
  data: AdminPatient[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface AdminPatientStatistics {
  total: number
  active: number
  locked: number
  deleted: number
}

export interface AdminPatientUpdatePayload {
  ho_ten: string
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null
  status: 'active' | 'locked'
  ngay_sinh?: string | null
  gioi_tinh?: 'nam' | 'nu' | 'khac' | null
  nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
  di_ung?: string | null
  benh_nen?: string | null
}

export const adminPatientService = {
  async getAll(params: {
    keyword?: string
    status?: string
    page?: number
    limit?: number
    isDeleted?: string
  } = {}): Promise<AdminPatientListResponse> {
    const { data } = await axios.get('/admin/patients', { params })
    return { data: data.data, pagination: data.pagination }
  },

  async getStatistics(): Promise<AdminPatientStatistics> {
    const { data } = await axios.get('/admin/patients/statistics')
    return data.data
  },

  async getById(id: string): Promise<AdminPatient> {
    const { data } = await axios.get(`/admin/patients/${id}`)
    return data.data
  },

  async update(id: string, payload: AdminPatientUpdatePayload): Promise<AdminPatient> {
    const { data } = await axios.put(`/admin/patients/${id}`, payload)
    return data.data
  },

  async softDelete(id: string): Promise<void> {
    await axios.patch(`/admin/patients/${id}/delete`)
  },

  async lock(id: string): Promise<AdminPatient> {
    const { data } = await axios.patch(`/admin/patients/${id}/lock`)
    return data.data
  },

  async unlock(id: string): Promise<AdminPatient> {
    const { data } = await axios.patch(`/admin/patients/${id}/unlock`)
    return data.data
  },

  async restore(id: string): Promise<AdminPatient> {
    const { data } = await axios.patch(`/admin/patients/${id}/restore`)
    return data.data
  },

  async getExamHistory(id: string): Promise<AdminPatientExamHistory[]> {
    const { data } = await axios.get(`/admin/patients/${id}/exam-history`)
    return data.data
  },

  async getAuditLogs(id: string): Promise<AdminPatientAuditLog[]> {
    const { data } = await axios.get(`/admin/patients/${id}/audit-logs`)
    return data.data
  },
}
