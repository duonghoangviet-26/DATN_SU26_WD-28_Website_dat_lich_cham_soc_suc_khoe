import axiosInstance from '@/services/axiosInstance'
import type { AdminDashboardSummary, ApiResponse } from '@/types'

export const dashboardService = {
  async getSummary(signal?: AbortSignal): Promise<AdminDashboardSummary> {
    const res = await axiosInstance.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard', { signal })
    return res.data.data
  },
}
