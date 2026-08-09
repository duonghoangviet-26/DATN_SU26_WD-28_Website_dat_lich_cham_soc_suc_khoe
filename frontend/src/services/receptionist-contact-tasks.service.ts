import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface ContactTask {
  audit_id: string
  appointment_id: string
  loai_viec: 'thong_bao_thu_cong' | 'xac_nhan_den_muon'
  trang_thai: 'chua_goi' | 'da_goi'
  ten_khach: string | null
  so_dien_thoai: string | null
  ma_lich_hen: string | null
  gio_kham_cu: string | null
  gio_kham_moi: string | null
  bac_si: string | null
  tieu_de: string | null
  noi_dung: string | null
  ly_do_can_goi: string | null
  phut_tre: number | null
  ngay_tao: string
  da_goi_luc: string | null
  da_goi_boi: string | null
  ghi_chu_cuoc_goi: string | null
  ket_qua_cuoc_goi: string | null
}

export const receptionistContactTasksService = {
  async list(params?: { trang_thai?: 'chua_goi' | 'da_goi'; tu_ngay?: string; den_ngay?: string }): Promise<ContactTask[]> {
    const response = await axiosInstance.get<ApiResponse<ContactTask[]>>('/receptionist/contact-tasks', { params })
    return response.data.data ?? []
  },

  async markDone(auditId: string, ghiChu?: string, ketQua?: string): Promise<{ id: string }> {
    const response = await axiosInstance.patch<ApiResponse<{ id: string }>>(`/receptionist/contact-tasks/${auditId}/done`, { ghi_chu: ghiChu, ket_qua: ketQua })
    return response.data.data
  },
}
