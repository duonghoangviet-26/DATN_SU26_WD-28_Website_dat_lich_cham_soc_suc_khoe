import { mockDoctorAppointments } from '@/mock/doctor-appointments'
import type { DoctorAppointmentDetail, AppointmentStatus, PaymentStatus } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let appointments = [...mockDoctorAppointments]

interface Filters {
  status?: AppointmentStatus | ''
  date?: string
}

export const doctorAppointmentService = {
  async getAll({ status = '', date = '' }: Filters = {}): Promise<DoctorAppointmentDetail[]> {
    await delay()
    let list = [...appointments]
    if (status) list = list.filter(a => a.status === status)
    if (date)   list = list.filter(a => a.ngay_kham === date)
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (status) params.status = status
    // if (date)   params.date   = date
    // const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail[]>>('/doctor/appointments', { params })
    // return res.data.data
  },

  async getById(id: string | number): Promise<DoctorAppointmentDetail> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    return { ...item }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail>>(`/doctor/appointments/${id}`)
    // return res.data.data
  },

  async confirm(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    // Chỉ set deadline khi BN chưa thanh toán — đã paid thì không cần chờ (khớp backend thật).
    const deadline = item?.payment_status === 'unpaid'
      ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      : null
    if (item) {
      item.status = 'confirmed'
      item.payment_deadline = deadline
    }
    return { id: Number(id), status: 'confirmed', payment_deadline: deadline }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/confirm`)
    // return res.data.data
  },

  async complete(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (item) { item.status = 'completed' }
    return { id: Number(id), status: 'completed', da_co_ket_qua: false }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/complete`)
    // return res.data.data
  },

  async reject(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    const payment_status: PaymentStatus = item?.payment_status === 'paid' ? 'refunded' : 'unpaid'
    if (item) {
      item.status = 'cancelled'
      item.ly_do_huy = ly_do
      item.payment_status = payment_status
    }
    return { id, status: 'cancelled', payment_status }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    // return res.data.data
  },

  async cancelConfirmed(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    // BS hủy confirmed + paid → hoàn tiền 100%; unpaid → không có giao dịch cần hoàn
    const payment_status: PaymentStatus = item?.payment_status === 'paid' ? 'refunded' : 'unpaid'
    if (item) {
      item.status = 'cancelled'
      item.ly_do_huy = ly_do
      item.payment_status = payment_status
      item.payment_deadline = null
    }
    return { id, status: 'cancelled', payment_status }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    // return res.data.data
  },
}
