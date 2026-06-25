import { mockAppointments } from '@/mock/appointments'
import type { AppointmentItem, AppointmentStatus } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let appointments = [...mockAppointments]

interface AppointmentFilters {
  keyword?: string
  status?: AppointmentStatus | ''
  loai_kham?: string
  payment_status?: string
  from?: string
  to?: string
}

export const appointmentService = {
  async getAll({
    keyword = '', status = '', loai_kham = '', payment_status = '', from = '', to = '',
  }: AppointmentFilters = {}): Promise<AppointmentItem[]> {
    await delay()
    let list = [...appointments]
    if (keyword) {
      const q = keyword.toLowerCase()
      list = list.filter(a =>
        a.benh_nhan.toLowerCase().includes(q) || a.bac_si.toLowerCase().includes(q),
      )
    }
    if (status)         list = list.filter(a => a.status === status)
    if (loai_kham)      list = list.filter(a => a.loai_kham === loai_kham)
    if (payment_status) list = list.filter(a => a.payment_status === payment_status)
    if (from)           list = list.filter(a => a.ngay_kham >= from)
    if (to)             list = list.filter(a => a.ngay_kham <= to)
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (keyword) params.search = keyword
    // ... etc
    // const res = await axiosInstance.get<ApiResponse<AppointmentItem[]>>('/admin/appointments', { params })
    // return res.data.data
  },

  async getById(id: string): Promise<AppointmentItem> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    return { ...item }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<AppointmentItem>>(`/admin/appointments/${id}`)
    // return res.data.data
  },

  async cancel(id: string, ly_do?: string): Promise<{ id: string; status: AppointmentStatus }> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (item) item.status = 'cancelled'
    return { id, status: 'cancelled' }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus }>>(`/admin/appointments/${id}/cancel`, { ly_do })
    // return res.data.data
  },
}
