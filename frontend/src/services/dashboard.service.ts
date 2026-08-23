import axiosInstance from '@/services/axiosInstance'
import type { AdminDashboardSummary, ApiResponse, RevenueDetails, InvoicedDetails, DebtItem } from '@/types'

export const dashboardService = {
  async getSummary(signal?: AbortSignal): Promise<AdminDashboardSummary> {
    const res = await axiosInstance.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard', { signal })
    return res.data.data
  },
  
  async getRevenueDetails(signal?: AbortSignal): Promise<RevenueDetails> {
    const res = await axiosInstance.get<ApiResponse<RevenueDetails>>('/admin/dashboard/revenue-details', { signal })
    return res.data.data
  },

  async getInvoicedDetails(signal?: AbortSignal): Promise<InvoicedDetails> {
    const res = await axiosInstance.get<ApiResponse<InvoicedDetails>>('/admin/dashboard/invoiced-details', { signal })
    return res.data.data
  },

  async getDebtList(signal?: AbortSignal): Promise<DebtItem[]> {
    const res = await axiosInstance.get<ApiResponse<DebtItem[]>>('/admin/dashboard/debt-list', { signal })
    return res.data.data
  },

  async remindDebt(data: DebtItem): Promise<{ message: string }> {
    const res = await axiosInstance.post<ApiResponse<{ message: string }>>('/admin/dashboard/remind-debt', { data })
    return res.data.data
  }
}
