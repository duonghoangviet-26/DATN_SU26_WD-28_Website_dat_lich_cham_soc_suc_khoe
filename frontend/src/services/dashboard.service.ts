import axiosInstance from '@/services/axiosInstance'
import type { AdminDashboardSummary, ApiResponse } from '@/types'

export const dashboardService = {
  async getSummary(): Promise<AdminDashboardSummary> {
    const res = await axiosInstance.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard')
    return res.data.data
  },
}
