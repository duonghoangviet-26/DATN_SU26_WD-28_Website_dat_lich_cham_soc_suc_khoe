import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

// C6/D78 — một dòng "biên bản ca khẩn" tổng hợp từ NhatKyThaoTac + trạng thái HangDoi hiện tại.
export interface EmergencyReportRow {
  id: string
  queue_id: string
  thoi_diem_tiep_nhan: string
  nguoi_tiep_nhan: string
  ten_benh_nhan: string | null
  so_dien_thoai: string | null
  ma_so_thu_tu: string | null
  ly_do_cap_cuu: string | null
  trang_thai_hien_tai: string | null
  bac_si_phu_trach: string | null
  phong_kham: string | null
  thoi_diem_hoan_thanh: string | null
}

export const receptionistEmergencyReportService = {
  async list(ngay?: string): Promise<EmergencyReportRow[]> {
    const response = await axiosInstance.get<ApiResponse<EmergencyReportRow[]>>('/receptionist/emergency-report', {
      params: ngay ? { ngay } : {},
    })
    return Array.isArray(response.data.data) ? response.data.data : []
  },
}
