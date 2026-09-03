import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface PatientRecordListItem {
  id: string
  loai_kham: 'clinic' | 'home'
  ngay_kham: string
  gio_kham: string
  ten_dich_vu: string
  phong_kham?: string | null
  dia_chi_kham?: string | null
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'waiting_record' | 'waiting_doctor_confirm' | 'skipped' | string
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  gia_kham: number
  payment_deadline?: string | null
  ly_do_huy?: string | null
  ten_khach?: string | null
  so_dien_thoai_khach?: string | null
  nam_sinh_khach?: number | string | null
  member_id?: string | null
  ho_so_benh_nhan_id?: string | null
  bac_si: {
    ho_ten: string
    anh_dai_dien?: string | null
  }
  da_co_ket_qua?: boolean
}

export interface PatientRecordDetail extends PatientRecordListItem {
  ly_do_kham?: string | null
  bac_si: {
    ho_ten: string
    anh_dai_dien?: string | null
    so_dien_thoai?: string | null
  }
  ket_qua: null | {
    id: string
    chan_doan: string
    huong_dan_dieu_tri: string
    ghi_chu?: string | null
    ngay_tai_kham?: string | null
    ngay_tao: string
    sinh_hieu?: {
      can_nang?: number | null
      chieu_cao?: number | null
      huyet_ap?: string | null
      nhiet_do?: number | null
      nhip_tim?: number | null
    } | null
    thuoc: Array<{
      ten_thuoc?: string
      lieu_luong?: string
      tan_suat?: string
      gio_uong?: string[]
      so_ngay?: number
      ngay_bat_dau?: string
      ngay_ket_thuc?: string
      ghi_chu?: string | null
    } | string>
    hinh_anh_noi_soi?: Array<{
      url: string
      mo_ta?: string | null
      uploaded_at?: string | null
    }>
    dich_vu_phat_sinh?: Array<{
      ten: string
      so_luong?: number
      don_gia?: number
      thanh_tien?: number
    }>
  }
  hoa_don?: null | {
    so_hoa_don?: string
    tong_tien_kham?: number
    tong_tien_phat_sinh?: number
    tong_thanh_toan?: number
    trang_thai_hoa_don?: string
    chi_tiet_thu_phi?: Array<{
      loai?: string
      ten?: string
      so_tien?: number
      so_luong?: number
      thanh_tien?: number
    }>
  }
}

interface PatientRecordListResponse {
  total: number
  page: number
  limit: number
  server_time?: string
  data: PatientRecordListItem[]
}

export interface MedicalResultItem {
  id: string
  ngay_kham: string
  gio_kham: string
  ten_dich_vu: string
  phong_kham?: string | null
  dia_chi_kham?: string | null
  ten_khach?: string | null
  member_id?: string | null
  ho_so_benh_nhan_id?: string | null
  bac_si: {
    ho_ten: string
    anh_dai_dien?: string | null
  }
  ket_qua: {
    id: string
    chan_doan: string
    huong_dan_dieu_tri: string
    ghi_chu?: string | null
    ngay_tai_kham?: string | null
    ngay_tao: string
    sinh_hieu?: {
      can_nang?: number | null
      chieu_cao?: number | null
      huyet_ap?: string | null
      nhiet_do?: number | null
      nhip_tim?: number | null
    } | null
    thuoc: Array<{
      ten_thuoc?: string
      lieu_luong?: string
      tan_suat?: string
      gio_uong?: string[]
      so_ngay?: number
      ngay_bat_dau?: string
      ngay_ket_thuc?: string
      ghi_chu?: string | null
    } | string>
    hinh_anh_noi_soi?: Array<{
      url: string
      mo_ta?: string | null
      uploaded_at?: string | null
    }>
  }
}

interface MedicalResultListResponse {
  total: number
  page: number
  limit: number
  data: MedicalResultItem[]
}

export const patientRecordsService = {
  async getAppointments(status?: string, limit: number = 100): Promise<PatientRecordListResponse> {
    const res = await axiosInstance.get<ApiResponse<PatientRecordListResponse>>('/patient/records', {
      params: { ...(status ? { status } : {}), limit },
    })
    return res.data.data
  },

  async getMedicalResults(params?: { page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<MedicalResultListResponse> {
    const res = await axiosInstance.get<ApiResponse<MedicalResultListResponse>>('/patient/records/medical-results', {
      params
    })
    return res.data.data
  },

  async getAppointmentDetail(id: string): Promise<PatientRecordDetail> {
    const res = await axiosInstance.get<ApiResponse<PatientRecordDetail>>(`/patient/records/${id}`)
    return res.data.data
  },

  async updateAppointmentContact(id: string, payload: { ho_ten: string; so_dien_thoai: string }): Promise<Pick<PatientRecordDetail, 'id' | 'ten_khach' | 'so_dien_thoai_khach'>> {
    const res = await axiosInstance.patch<ApiResponse<Pick<PatientRecordDetail, 'id' | 'ten_khach' | 'so_dien_thoai_khach'>>>(
      `/patient/records/${id}/contact`,
      payload,
    )
    return res.data.data
  },

  async cancelAppointment(id: string, ly_do = 'Bệnh nhân hủy lịch'): Promise<{ id: string; status: string; payment_status: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string; payment_status: string }>>(
      `/patient/booking/${id}/cancel`,
      { ly_do }
    )
    return res.data.data
  },

  async deleteAppointment(id: string): Promise<{ id: string }> {
    const res = await axiosInstance.delete<ApiResponse<{ id: string }>>(`/patient/records/${id}`)
    return res.data.data
  },

  async deleteBatchCancelledAppointments(): Promise<{ deletedCount: number }> {
    const res = await axiosInstance.delete<ApiResponse<{ deletedCount: number }>>('/patient/records/batch-cancelled')
    return res.data.data
  },
}
