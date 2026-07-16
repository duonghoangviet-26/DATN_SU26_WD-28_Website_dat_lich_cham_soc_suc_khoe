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
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  gia_kham: number
  payment_deadline?: string | null
  ly_do_huy?: string | null
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
    thuoc: Array<{
      ten_thuoc?: string
      lieu_luong?: string
      tan_suat?: string
      gio_uong?: string[]
      ngay_bat_dau?: string
      ngay_ket_thuc?: string
      ghi_chu?: string | null
    } | string>
  }
}

interface PatientRecordListResponse {
  total: number
  page: number
  limit: number
  data: PatientRecordListItem[]
}

export const patientRecordsService = {
  async getAppointments(status?: string): Promise<PatientRecordListResponse> {
    const res = await axiosInstance.get<ApiResponse<PatientRecordListResponse>>('/patient/records', {
      params: status ? { status } : undefined,
    })
    return res.data.data
  },

  async getAppointmentDetail(id: string): Promise<PatientRecordDetail> {
    const res = await axiosInstance.get<ApiResponse<PatientRecordDetail>>(`/patient/records/${id}`)
    return res.data.data
  },

  async cancelAppointment(id: string, ly_do = 'Bệnh nhân hủy lịch'): Promise<{ id: string; status: string; payment_status: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string; payment_status: string }>>(
      `/patient/booking/${id}/cancel`,
      { ly_do }
    )
    return res.data.data
  },
}
