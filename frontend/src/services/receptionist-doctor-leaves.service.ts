import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'
import type { SuddenLeaveProposalSummary, SuddenLeaveSkippedAppointment } from '@/services/receptionist-booking.service'

export interface PendingDoctorLeave {
  _id: string
  bac_si_id: string | null
  bac_si: { _id: string; user_id: string | null; ho_ten: string | null; trang_thai: string | null } | null
  tu_ngay: string
  den_ngay: string
  gio_bat_dau?: string | null
  gio_ket_thuc?: string | null
  ly_do: string | null
  trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy'
  nguon_tao?: 'bac_si_tu_gui' | 'le_tan_ghi_nhan' | 'admin_tao' | null
  ngay_tao: string | null
}

export interface ApproveDoctorLeaveResult extends PendingDoctorLeave {
  so_slot_da_khoa: number
  lich_hen_can_xu_ly: Array<{ id: string; ma_lich_hen: string | null; ngay_kham: string; gio_kham: string; status: string; ten_khach: string | null }>
  can_dieu_phoi_tai_quay: SuddenLeaveSkippedAppointment[]
  de_xuat_doi: SuddenLeaveProposalSummary[]
  so_lich_cho_admin_duyet: number
  so_lich_khong_co_phuong_an: number
}

export const receptionistDoctorLeavesService = {
  async listPending(): Promise<PendingDoctorLeave[]> {
    const res = await axiosInstance.get<ApiResponse<PendingDoctorLeave[]>>('/receptionist/doctor-leaves/pending')
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async approve(id: string, ghi_chu?: string): Promise<ApproveDoctorLeaveResult> {
    const res = await axiosInstance.patch<ApiResponse<ApproveDoctorLeaveResult>>(`/receptionist/doctor-leaves/${id}/approve`, { ghi_chu })
    return res.data.data
  },

  async reject(id: string, ghi_chu: string): Promise<PendingDoctorLeave> {
    const res = await axiosInstance.patch<ApiResponse<PendingDoctorLeave>>(`/receptionist/doctor-leaves/${id}/reject`, { ghi_chu })
    return res.data.data
  },
}
