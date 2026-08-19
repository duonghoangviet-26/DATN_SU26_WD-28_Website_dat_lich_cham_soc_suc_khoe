import axiosInstance from '@/services/axiosInstance'
import type { AdminDashboardSummary, ApiResponse, RevenueDetails } from '@/types'

export const dashboardService = {
  async getSummary(signal?: AbortSignal): Promise<AdminDashboardSummary> {
    const res = await axiosInstance.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard', { signal })
    return res.data.data
  },
  
  async getRevenueDetails(signal?: AbortSignal): Promise<RevenueDetails> {
    const res = await axiosInstance.get<ApiResponse<RevenueDetails>>('/admin/dashboard/revenue-details', { signal })
    return res.data.data
  }
}
