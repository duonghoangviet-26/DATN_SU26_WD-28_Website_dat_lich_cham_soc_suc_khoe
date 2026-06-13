import type { AppointmentItem, AppointmentStatus } from '@/types'
import { mockAppointments } from '@/mock/appointments'
import { delay, findOrThrow } from '@/utils/format'

let appointments: AppointmentItem[] = [...mockAppointments]

interface AppointmentFilters {
  keyword?: string
  status?: AppointmentStatus | ''
  loai_kham?: string
}

export const appointmentService = {
  async getAll({ keyword = '', status = '', loai_kham = '' }: AppointmentFilters = {}): Promise<AppointmentItem[]> {
    await delay()
    let result = [...appointments]
    if (keyword) {
      const kw = keyword.toLowerCase()
      result = result.filter(
        (a) => a.benh_nhan.toLowerCase().includes(kw) || a.bac_si.toLowerCase().includes(kw),
      )
    }
    if (status) result = result.filter((a) => a.status === status)
    if (loai_kham) result = result.filter((a) => a.loai_kham === loai_kham)
    return result
  },

  async cancel(id: number): Promise<AppointmentItem> {
    await delay(200)
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'cancelled', payment_status: a.payment_status === 'paid' ? 'refunded' : a.payment_status } : a,
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  },
}
