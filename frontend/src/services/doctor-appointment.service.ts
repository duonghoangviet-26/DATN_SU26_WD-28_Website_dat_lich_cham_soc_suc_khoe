import { mockDoctorAppointments } from '@/mock/doctor-appointments'
import { syncSlotOnAppointmentCancel } from './schedule.service'
import type { DoctorAppointmentDetail, AppointmentStatus, PaymentStatus } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

// "Hủy khẩn cấp" (clinic, confirmed) chỉ cho phép trong vòng X giờ tới giờ hẹn — khớp
// EMERGENCY_CANCEL_WINDOW_HOURS ở DoctorAppointments.tsx. Quá mốc này bác sĩ phải dùng
// "Yêu cầu hủy" (Lịch làm việc) để Admin duyệt/chuyển bác sĩ khác thay vì tự hủy tức thời.
const EMERGENCY_CANCEL_WINDOW_HOURS = 24

let appointments = [...mockDoctorAppointments]

interface Filters {
  status?: AppointmentStatus | ''
  date?: string
  tab?: 'today' | 'upcoming' | 'past' | 'all'
}

export const doctorAppointmentService = {
  async getAll({ status = '', date = '', tab = 'all' }: Filters = {}): Promise<DoctorAppointmentDetail[]> {
    await delay()
    const todayStr = new Date().toISOString().slice(0, 10)
    let list = [...appointments]
    // Ẩn hẳn pending+unpaid (Luồng C legacy, quyết định 2026-07-04) khỏi mọi tab bác sĩ xem —
    // không còn tự phát sinh qua flow đặt lịch thật (mọi lịch mới đều paid ngay lúc đặt),
    // chỉ gây nhiễu danh sách nếu còn sót dữ liệu cũ/tạo tay.
    list = list.filter(a => !(a.status === 'pending' && a.payment_status !== 'paid'))
    if (status) list = list.filter(a => a.status === status)
    if (date)   list = list.filter(a => a.ngay_kham === date)
    if (tab === 'today')    list = list.filter(a => a.ngay_kham === todayStr)
    if (tab === 'upcoming') list = list.filter(a => a.ngay_kham > todayStr)
    if (tab === 'past')     list = list.filter(a => a.ngay_kham < todayStr)
    list.sort((a, b) => a.ngay_kham.localeCompare(b.ngay_kham) || a.gio_kham.localeCompare(b.gio_kham))
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
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    if (item.status !== 'pending') throw new Error('Chỉ xác nhận lịch hẹn đang chờ xử lý')
    // Chỉ lịch đã thanh toán mới được xác nhận — mọi lịch đặt mới đều thanh toán ngay
    // lúc đặt (quyết định 2026-07-02) nên unpaid chỉ còn có thể là dữ liệu cũ/tạo tay,
    // không phải luồng hợp lệ để bác sĩ tự xác nhận.
    if (item.payment_status !== 'paid') throw new Error('Chỉ xác nhận lịch hẹn đã thanh toán')
    item.status = 'confirmed'
    item.payment_deadline = null
    return { id: Number(id), status: 'confirmed', payment_status: item.payment_status, payment_deadline: null }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/confirm`)
    // return res.data.data
  },

  async complete(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    if (item.status !== 'confirmed') throw new Error('Chỉ hoàn thành lịch hẹn đã xác nhận')
    item.status = 'completed'
    return { id: Number(id), status: 'completed', da_co_ket_qua: item.da_co_ket_qua }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/complete`)
    // return res.data.data
  },

  async reject(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus; ly_do_huy: string }> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    if (item.status !== 'pending') throw new Error('Chỉ từ chối lịch hẹn đang chờ xử lý')
    const payment_status: PaymentStatus = item.payment_status === 'paid' ? 'refunded' : 'unpaid'
    item.status = 'cancelled'
    item.ly_do_huy = ly_do
    item.payment_status = payment_status
    return { id, status: 'cancelled', payment_status, ly_do_huy: ly_do }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    // return res.data.data
  },

  async cancelConfirmed(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus; ly_do_huy: string; payment_deadline: string | null }> {
    await delay()
    const item = appointments.find(a => String(a.id) === String(id))
    if (!item) throw new Error('Không tìm thấy lịch hẹn')
    if (item.status !== 'confirmed') throw new Error('Chỉ hủy lịch hẹn đã xác nhận')
    if (item.loai_kham === 'clinic') {
      const [h, m] = item.gio_kham.split(':').map(Number)
      const gioKham = new Date(item.ngay_kham)
      gioKham.setHours(h, m, 0, 0)
      if (gioKham.getTime() - Date.now() >= EMERGENCY_CANCEL_WINDOW_HOURS * 3600 * 1000) {
        throw new Error(`Lịch hẹn còn hơn ${EMERGENCY_CANCEL_WINDOW_HOURS}h — vui lòng dùng "Yêu cầu hủy" ở Lịch làm việc để Admin xử lý`)
      }
    }
    // BS hủy confirmed + paid → hoàn tiền 100%; unpaid → không có giao dịch cần hoàn
    const payment_status: PaymentStatus = item.payment_status === 'paid' ? 'refunded' : 'unpaid'
    item.status = 'cancelled'
    item.ly_do_huy = ly_do
    item.payment_status = payment_status
    item.payment_deadline = null
    // Hủy khẩn cấp clinic confirmed → khóa slot vĩnh viễn (khớp backend, xem comment
    // tại syncSlotOnAppointmentCancel). Home không dùng slot nên bỏ qua.
    if (item.loai_kham === 'clinic') syncSlotOnAppointmentCancel(item.ngay_kham, item.gio_kham)
    return { id, status: 'cancelled', payment_status, ly_do_huy: ly_do, payment_deadline: null }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    // return res.data.data
  },
}
