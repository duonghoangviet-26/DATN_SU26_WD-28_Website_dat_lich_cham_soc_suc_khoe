import type {
  AppointmentItem,
  AppointmentListResponse,
  AdminAppointmentDoctorOption,
  AdminAppointmentServiceOption,
} from '@/types'
import axiosInstance from './axiosInstance'

export const appointmentService = {
  async getAll(params?: {
    keyword?: string
    status?: string
    loai_kham?: string
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
    view_mode?: string
    doctor_id?: string
  }): Promise<any> {
    const res = await axiosInstance.get('/admin/appointments', { params })
    return {
      data: res.data.data,
      pagination: res.data.pagination,
      summary: res.data.summary,
    }
  },

  async getById(id: string): Promise<AppointmentItem> {
    const res = await axiosInstance.get(`/admin/appointments/${id}`)
    return res.data.data
  },

  async getAppointmentHistory(id: string): Promise<any[]> {
    const res = await axiosInstance.get(`/admin/appointments/${id}/history`)
    return res.data.data
  },

  async cancel(id: string, ly_do_huy: string): Promise<AppointmentItem> {
    const res = await axiosInstance.patch(`/admin/appointments/${id}/cancel`, { ly_do_huy })
    return res.data.data
  },

  async restore(id: string): Promise<void> {
    await axiosInstance.patch(`/admin/appointments/${id}/restore`)
  },

  async hardDelete(id: string): Promise<void> {
    await axiosInstance.delete(`/admin/appointments/${id}`)
  },

  async reschedule(
    id: string,
    data: { doctor_id: string, schedule_id: string, slot_id: string }
  ): Promise<AppointmentItem> {
    const res = await axiosInstance.patch(`/admin/appointments/${id}/reschedule`, data)
    return res.data.data
  },

  async create(data: {
    user_id: string
    ten_khach: string
    so_dien_thoai_khach: string
    doctor_id: string
    schedule_id: string
    slot_id: string
    service_id: string
    loai_kham: 'clinic' | 'home'
    dia_chi_kham: string
    ly_do_kham?: string
  }): Promise<AppointmentItem> {
    const res = await axiosInstance.post('/admin/appointments', data)
    return res.data.data
  },

  async getActiveDoctors(): Promise<AdminAppointmentDoctorOption[]> {
    const res = await axiosInstance.get('/admin/appointments/doctors/active')
    return res.data.data
  },

  async getActiveServices(loai?: 'clinic' | 'home'): Promise<AdminAppointmentServiceOption[]> {
    const res = await axiosInstance.get('/admin/appointments/services/active', {
      params: loai ? { loai } : undefined,
    })
    return res.data.data
  },

  async getDoctorSchedules(doctorId: string): Promise<any[]> {
    const res = await axiosInstance.get(`/admin/appointments/doctors/${doctorId}/schedules`)
    return res.data.data
  },
}
