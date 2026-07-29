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

export const receptionistBookingService = {
  async getSlots(doctorId: string, date: string): Promise<ReceptionistBookingSlot[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistBookingSlot[]>>(`/receptionist/booking/doctors/${doctorId}/slots`, {
      params: { date },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  }
}
