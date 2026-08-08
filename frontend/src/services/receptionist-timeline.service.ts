import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface TimelineRow {
  nguon: 'nhat_ky' | 'lich_su_lich_hen'
  thoi_diem: string
  nguoi: { ho_ten: string | null; vai_tro: string | null }
  hanh_dong: string
  nhan: string
  ly_do?: string | null
  thay_doi: Array<{ truong: string; cu: unknown; moi: unknown }>
}

export interface TimelineResult {
  rows: TimelineRow[]
  sua_gan_nhat: TimelineRow | null
}

export const receptionistTimelineService = {
  async getForHoSo(hoSoBenhNhanId: string): Promise<TimelineResult> {
    const response = await axiosInstance.get<ApiResponse<TimelineResult>>('/receptionist/timeline', {
      params: { loai: 'ho_so', id: hoSoBenhNhanId },
    })
    return response.data.data as TimelineResult
  },

  async getForLichHen(lichHenId: string): Promise<TimelineResult> {
    const response = await axiosInstance.get<ApiResponse<TimelineResult>>('/receptionist/timeline', {
      params: { loai: 'lich_hen', id: lichHenId },
    })
    return response.data.data as TimelineResult
  },
}
