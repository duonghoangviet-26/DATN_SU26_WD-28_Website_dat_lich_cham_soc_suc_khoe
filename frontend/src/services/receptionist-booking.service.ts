import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface ReceptionistBookingSlot {
  id: string
  schedule_id: string
  gio_bat_dau: string
  gio_ket_thuc: string
  phong_kham?: string | null
  is_full?: boolean
}

export interface DayOverviewKhungRow {
  khung_index: number
  gio_bat_dau: string
  gio_ket_thuc: string
  tong_slot: number
  con_trong: number
  khoa_boi_nghi_phep: boolean
}

export interface DayOverviewDoctor {
  doctor_id: string
  ten_bac_si: string
  trang_thai_bac_si: string
  trang_thai_ngay: 'lam_viec' | 'nghi' | 'nghi_phep' | 'khong_co_lich'
  ca_sang: DayOverviewKhungRow[]
  ca_chieu: DayOverviewKhungRow[]
}

export interface DayOverview {
  ngay: string
  doctors: DayOverviewDoctor[]
}

export const receptionistBookingService = {
  async getSlots(doctorId: string, date: string): Promise<ReceptionistBookingSlot[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistBookingSlot[]>>(`/receptionist/booking/doctors/${doctorId}/slots`, {
      params: { date },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getDayOverview(date: string): Promise<DayOverview> {
    const res = await axiosInstance.get<ApiResponse<DayOverview>>('/receptionist/booking/day-overview', {
      params: { date },
    })
    return res.data.data
  },
}
