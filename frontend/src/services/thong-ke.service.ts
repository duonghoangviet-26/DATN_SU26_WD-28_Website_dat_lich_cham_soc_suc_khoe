import axiosInstance from '@/services/axiosInstance'
import type {
  AppointmentStatusStatistic,
  DoctorRevenueStatistic,
  MonthlyNewPatientStatistic,
  RevenueDailyStatistic,
  TopServiceStatistic,
} from '@/types/thong-ke'

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

const pendingRequests = new Map<string, Promise<unknown>>()

function getOnce<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key) as Promise<T> | undefined
  if (existing) return existing

  const pending = request().finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, pending)
  return pending
}

function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

async function getData<T>(url: string): Promise<T> {
  const res = await axiosInstance.get<ApiResponse<T>>(url)
  return res.data.data
}

export const thongKeService = {
  getRevenueByDay(tu: string, den: string) {
    const url = `/thong-ke/doanh-thu-theo-ngay${queryString({ tu, den })}`
    return getOnce(url, () => getData<RevenueDailyStatistic[]>(url))
  },

  getAppointmentStatuses(tu: string, den: string) {
    const url = `/thong-ke/lich-hen-theo-trang-thai${queryString({ tu, den })}`
    return getOnce(url, () => getData<AppointmentStatusStatistic[]>(url))
  },

  getDoctorRevenue(thang: string) {
    const url = `/thong-ke/doanh-thu-theo-bac-si${queryString({ thang })}`
    return getOnce(url, () => getData<DoctorRevenueStatistic[]>(url))
  },

  getMonthlyNewPatients(nam: string) {
    const url = `/thong-ke/benh-nhan-moi-theo-thang${queryString({ nam })}`
    return getOnce(url, () => getData<MonthlyNewPatientStatistic[]>(url))
  },

  getTopServices(tu: string, den: string) {
    const url = `/thong-ke/dich-vu-pho-bien${queryString({ tu, den })}`
    return getOnce(url, () => getData<TopServiceStatistic[]>(url))
  },
}
