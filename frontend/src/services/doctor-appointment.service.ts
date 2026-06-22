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
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'confirmed', payment_status: a.payment_status } : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },

  async reject(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
    await delay(200)
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
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'completed' } : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },

  async cancelConfirmed(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
    await delay(200)
    appointments = appointments.map((a) =>
      a.id === id
        ? { ...a, status: 'cancelled', payment_status: 'refunded', ly_do_huy: ly_do }
        : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },
}
