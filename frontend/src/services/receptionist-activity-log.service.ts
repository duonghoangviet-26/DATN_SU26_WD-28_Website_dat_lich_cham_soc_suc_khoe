import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface ActivityLogRow {
  id: string
  thoi_diem: string
  hanh_dong: string
  nhan_hanh_dong: string
  nhom: string | null
  nguoi_thuc_hien_id: string | null
  nguoi_thuc_hien: string
  loai_doi_tuong: string
  doi_tuong_id: string
  ten_khach: string | null
  chi_tiet: Record<string, unknown> | null
}

export interface ActivityLogParams {
  ngay?: string
  nguoi_id?: string
  nhom?: string
}

export interface ActivityLogResult {
  rows: ActivityLogRow[]
  nhom_kha_dung: string[]
}

export const receptionistActivityLogService = {
  async list(params: ActivityLogParams = {}): Promise<ActivityLogResult> {
    const response = await axiosInstance.get<ApiResponse<ActivityLogResult>>('/receptionist/activity-log', { params })
    return response.data.data
  },
}
