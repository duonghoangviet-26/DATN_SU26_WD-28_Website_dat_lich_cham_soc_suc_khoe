import type { ClinicItem, ClinicRoomItem, ClinicRoomOptions, ClinicRoomPayload, SpecialtyItem } from '@/types'
import axiosInstance from './axiosInstance'

export const clinicService = {
  async getCurrentClinic(): Promise<ClinicItem | null> {
    const res = await axiosInstance.get('/admin/clinics/current')
    return res.data.data
  },

  async saveCurrentClinic(payload: Partial<ClinicItem>): Promise<ClinicItem> {
    const res = await axiosInstance.put('/admin/clinics/current', payload)
    return res.data.data
  },

  async getCurrentClinicLogs(): Promise<any[]> {
    const res = await axiosInstance.get('/admin/clinics/current/logs')
    return res.data.data
  },

  async getRooms(params?: { status?: 'active' | 'inactive' | ''; keyword?: string }): Promise<ClinicRoomItem[]> {
    const res = await axiosInstance.get('/admin/clinics/rooms', { params })
    return res.data.data
  },

  async getRoomOptions(): Promise<ClinicRoomOptions> {
    const res = await axiosInstance.get('/admin/clinics/rooms/options')
    return res.data.data
  },

  async createRoom(payload: ClinicRoomPayload): Promise<ClinicRoomItem> {
    const res = await axiosInstance.post('/admin/clinics/rooms', payload)
    return res.data.data
  },

  async updateRoom(id: string, payload: ClinicRoomPayload): Promise<ClinicRoomItem> {
    const res = await axiosInstance.put(`/admin/clinics/rooms/${id}`, payload)
    return res.data.data
  },

  async deleteRoom(id: string): Promise<{ _id: string }> {
    const res = await axiosInstance.delete(`/admin/clinics/rooms/${id}`)
    return res.data.data
  },

  async getSpecialties(): Promise<SpecialtyItem[]> {
    const res = await axiosInstance.get('/admin/specialties')
    return res.data.data
  },

  async getDoctorsBySpecialty(specialtyId: string): Promise<any[]> {
    const res = await axiosInstance.get(`/admin/specialties/${specialtyId}/doctors`)
    return res.data.data
  },

  async createSpecialty(payload: Partial<SpecialtyItem>): Promise<SpecialtyItem> {
    const res = await axiosInstance.post('/admin/specialties', payload)
    return res.data.data
  },

  async updateSpecialty(id: string, payload: Partial<SpecialtyItem>): Promise<SpecialtyItem> {
    const res = await axiosInstance.put(`/admin/specialties/${id}`, payload)
    return res.data.data
  },

  async toggleSpecialtyStatus(id: string): Promise<SpecialtyItem> {
    const res = await axiosInstance.patch(`/admin/specialties/${id}/toggle`)
    return res.data.data
  },

  async getSpecialtyLogs(id: string): Promise<any[]> {
    const res = await axiosInstance.get(`/admin/specialties/${id}/logs`)
    return res.data.data
  },

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('image', file)
    const res = await axiosInstance.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data.url
  },
}
