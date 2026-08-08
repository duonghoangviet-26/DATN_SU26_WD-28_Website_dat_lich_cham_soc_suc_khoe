import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface QueueTransferResult {
  entry: { _id: string; doctor_id: string; phong_kham?: string | null }
  doctor_id_cu: string
  doctor_id_moi: string
  phong_kham_moi?: string | null
}

export interface QueueCancelResult {
  entry: { _id: string; trang_thai: string }
  appointment: { _id: string; status: string } | null
}

export const receptionistQueueService = {
  async transfer(entryId: string, payload: { doctor_id_moi: string; ly_do: string }): Promise<QueueTransferResult> {
    const response = await axiosInstance.patch<ApiResponse<QueueTransferResult>>(`/receptionist/queue/${entryId}/transfer`, payload)
    return response.data.data
  },

  async cancel(entryId: string, payload: { ly_do: string }): Promise<QueueCancelResult> {
    const response = await axiosInstance.patch<ApiResponse<QueueCancelResult>>(`/receptionist/queue/${entryId}/cancel`, payload)
    return response.data.data
  },
}
