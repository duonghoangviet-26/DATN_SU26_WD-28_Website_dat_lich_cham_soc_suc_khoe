import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'
import type { CentralOfflineCapacity } from '@/services/receptionist-patient-intake.service'

export interface OfflineQueueRow {
  id: string
  nguon?: 'online' | 'offline'
  appointment_id?: string | null
  ten_benh_nhan: string
  so_dien_thoai?: string | null
  ma_so_thu_tu?: string | null
  trang_thai: 'cho_dieu_phoi' | 'dang_cho' | 'da_goi' | 'trong_phong' | 'cho_dich_vu' | 'skipped' | 'cancelled' | 'hoan_thanh'
  checkin_time: string
  thoi_diem_vao_hang_doi_trung_tam?: string | null
  thoi_diem_duoc_dieu_phoi?: string | null
  thoi_gian_cho_uoc_tinh_phut?: number | null
  specialty?: { id: string; ten?: string | null } | null
  doctor?: { id: string; ho_ten?: string | null; phong_kham_mac_dinh?: string | null } | null
  phong_kham?: string | null
}

export interface DispatchCandidate {
  doctor_id: string
  bac_si?: string | null
  schedule_id: string
  slot_id?: string | null
  khung_index?: number | null
  gio_bat_dau?: string | null
  gio_ket_thuc?: string | null
  phong_kham?: string | null
  so_luot_dang_xu_ly: number
  hop_le: boolean
  ly_do_chan: string[]
  diem_tai: number
}

export interface DispatchSuggestion {
  queue_id: string
  ten_benh_nhan: string
  so_dien_thoai?: string | null
  ma_so_thu_tu?: string | null
  specialty?: { id: string; ten?: string | null } | null
  thoi_gian_cho_phut: number
  ung_vien: DispatchCandidate[]
  de_xuat_tot_nhat: DispatchCandidate | null
}

export const receptionistOfflineQueueService = {
  async list(params?: { specialty_id?: string; status?: string }): Promise<OfflineQueueRow[]> {
    const response = await axiosInstance.get<ApiResponse<OfflineQueueRow[]>>('/receptionist/offline-queue', { params })
    return response.data.data ?? []
  },

  // "Danh sách đã khám" — tra cứu ca khám theo ngày bất kỳ (mặc định hôm nay nếu không truyền `date`).
  async listSessions(params?: { specialty_id?: string; status?: string; doctor_id?: string; nguon?: string; search?: string; date?: string }): Promise<OfflineQueueRow[]> {
    const response = await axiosInstance.get<ApiResponse<OfflineQueueRow[]>>('/receptionist/offline-queue/sessions-today', { params })
    return response.data.data ?? []
  },

  async capacity(specialtyId: string): Promise<CentralOfflineCapacity> {
    const response = await axiosInstance.get<ApiResponse<CentralOfflineCapacity>>('/receptionist/offline-queue/capacity', {
      params: { specialty_id: specialtyId },
    })
    return response.data.data
  },

  async suggestions(params?: { specialty_id?: string; queue_id?: string }): Promise<{ checked_at: string; total: number; suggestions: DispatchSuggestion[] }> {
    const response = await axiosInstance.get<ApiResponse<{ checked_at: string; total: number; suggestions: DispatchSuggestion[] }>>(
      '/receptionist/offline-queue/dispatch-suggestions',
      { params },
    )
    return response.data.data
  },

  async assign(queueId: string, doctorId: string, lyDo?: string) {
    const response = await axiosInstance.post<ApiResponse<{ entry: OfflineQueueRow }>>(
      `/receptionist/offline-queue/${queueId}/assign`,
      { doctor_id: doctorId, ly_do: lyDo },
    )
    return response.data.data
  },

  async returnCentral(queueId: string, lyDo: string) {
    const response = await axiosInstance.post<ApiResponse<{ entry: OfflineQueueRow }>>(
      `/receptionist/offline-queue/${queueId}/return-central`,
      { ly_do: lyDo },
    )
    return response.data.data
  },

  async cancel(queueId: string, lyDo: string) {
    const response = await axiosInstance.patch<ApiResponse<{ entry: OfflineQueueRow }>>(
      `/receptionist/offline-queue/${queueId}/cancel`,
      { ly_do: lyDo },
    )
    return response.data.data
  },
}
