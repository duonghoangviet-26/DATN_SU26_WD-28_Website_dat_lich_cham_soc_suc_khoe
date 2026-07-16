import axiosInstance from './axiosInstance'
import type { ApiResponse } from '../types'

export interface VirtualNotification {
  id: string
  tieu_de: string
  noi_dung: string
  ngay_tao: string
  da_doc: boolean
  loai: string
  related_id: string
}

export const receptionistNotificationService = {
  async getRecentNotifications(): Promise<VirtualNotification[]> {
    const res = await axiosInstance.get<ApiResponse<VirtualNotification[]>>('/receptionist/notifications/recent')
    return Array.isArray(res.data.data) ? res.data.data : []
  }
}
