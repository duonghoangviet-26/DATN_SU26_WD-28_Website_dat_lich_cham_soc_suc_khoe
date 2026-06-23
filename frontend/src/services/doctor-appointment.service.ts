import type { DoctorAppointmentDetail, AppointmentStatus } from '@/types'
import { mockDoctorAppointments } from '@/mock/doctor-appointments'
import { delay, findOrThrow } from '@/utils/format'

let appointments: DoctorAppointmentDetail[] = [...mockDoctorAppointments]

interface Filters {
  tab?: 'today' | 'upcoming' | 'past' | 'all'
  status?: AppointmentStatus | ''
}

export const doctorAppointmentService = {
  async getAll({ tab = 'all', status = '' }: Filters = {}): Promise<DoctorAppointmentDetail[]> {
    await delay()
    const todayStr = new Date().toISOString().slice(0, 10)
    let result = [...appointments]

    if (tab === 'today') result = result.filter((a) => a.ngay_kham === todayStr)
    else if (tab === 'upcoming') result = result.filter((a) => a.ngay_kham > todayStr)
    else if (tab === 'past') result = result.filter((a) => a.ngay_kham < todayStr)

    if (status) result = result.filter((a) => a.status === status)

    return result.sort((a, b) => a.ngay_kham.localeCompare(b.ngay_kham) || a.gio_kham.localeCompare(b.gio_kham))
  },

  async confirm(id: number): Promise<DoctorAppointmentDetail> {
    await delay(200)
    const todayStr = new Date().toISOString().slice(0, 10)
    const appt = findOrThrow(appointments, id, 'Lịch hẹn')
    if (appt.status !== 'pending') {
      throw new Error('Chỉ xác nhận lịch hẹn đang chờ xác nhận')
    }
    if (appt.ngay_kham < todayStr) {
      throw new Error('Không thể xác nhận lịch hẹn đã quá ngày khám')
    }
    // Luồng C: nếu chưa thanh toán → set deadline 2 giờ để BN thanh toán
    const payment_deadline = appt.payment_status === 'unpaid'
      ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      : null
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'confirmed', payment_deadline } : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },

  async reject(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
    await delay(200)
    const appt = findOrThrow(appointments, id, 'Lịch hẹn')
    if (appt.status !== 'pending') {
      throw new Error('Chỉ từ chối lịch hẹn đang chờ xác nhận')
    }
    appointments = appointments.map((a) =>
      a.id === id
        ? {
            ...a,
            status: 'cancelled',
            ly_do_huy: ly_do,
            payment_status: a.payment_status === 'paid' ? 'refunded' : a.payment_status,
          }
        : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },

  async complete(id: number): Promise<DoctorAppointmentDetail> {
    await delay(200)
    const todayStr = new Date().toISOString().slice(0, 10)
    const appt = findOrThrow(appointments, id, 'Lịch hẹn')
    if (appt.status !== 'confirmed') {
      throw new Error('Chỉ hoàn thành lịch hẹn đã xác nhận')
    }
    if (appt.ngay_kham > todayStr) {
      throw new Error('Không thể hoàn thành lịch hẹn chưa đến ngày khám')
    }
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'completed' } : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },

  async cancelConfirmed(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
    await delay(200)
    const appt = findOrThrow(appointments, id, 'Lịch hẹn')
    if (appt.status !== 'confirmed') {
      throw new Error('Chỉ hủy lịch hẹn đã xác nhận bằng thao tác này')
    }
    // Chỉ refund khi BN đã thanh toán — unpaid không có gì để hoàn
    const new_payment_status = appt.payment_status === 'paid' ? 'refunded' : appt.payment_status
    appointments = appointments.map((a) =>
      a.id === id
        ? { ...a, status: 'cancelled', payment_status: new_payment_status, ly_do_huy: ly_do, payment_deadline: null }
        : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },
}
