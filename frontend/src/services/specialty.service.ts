import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

export interface SpecialtyOption {
  id: string
  ten: string
}

export const specialtyService = {
  async getAll(): Promise<SpecialtyOption[]> {
    const res = await axiosInstance.get<ApiResponse<SpecialtyOption[]>>('/admin/specialties')
    return res.data.data
  },
}
