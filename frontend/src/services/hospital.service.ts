import type { HospitalItem, SpecialtyItem } from '@/types'
import axiosInstance from './axiosInstance'

// Gọi API thật từ backend. Tất cả response có dạng { success, message, data }.

export const hospitalService = {
  // ==========================================
  // 1. Quản lý Chi nhánh (Phòng khám)
  // ==========================================
  async getAllClinics(status?: 'active' | 'inactive'): Promise<HospitalItem[]> {
    const params = status ? { status } : {}
    const res = await axiosInstance.get('/admin/clinic-info', { params })
    return res.data.data
  },

  async getClinicById(id: string): Promise<HospitalItem> {
    const res = await axiosInstance.get(`/admin/clinic-info/${id}`)
    return res.data.data
  },

  async createClinic(payload: Partial<HospitalItem>): Promise<HospitalItem> {
    const res = await axiosInstance.post('/admin/clinic-info', payload)
    return res.data.data
  },

  async updateClinicInfo(id: string, payload: Partial<HospitalItem>): Promise<HospitalItem> {
    const res = await axiosInstance.put(`/admin/clinic-info/${id}`, payload)
    return res.data.data
  },

  async deleteClinic(id: string): Promise<HospitalItem> {
    const res = await axiosInstance.delete(`/admin/clinic-info/${id}`)
    return res.data.data
  },

  // ---- Chuyên Khoa ----

  async getSpecialties(): Promise<SpecialtyItem[]> {
    const res = await axiosInstance.get('/admin/clinic/specialties')
    return res.data.data
  },

  async createSpecialty(data: { ten: string; mo_ta?: string; icon_url?: string; thu_tu?: number }): Promise<SpecialtyItem> {
    const res = await axiosInstance.post('/admin/clinic/specialties', data)
    return res.data.data
  },

  async updateSpecialty(id: string, data: { ten: string; mo_ta?: string; icon_url?: string; thu_tu?: number }): Promise<SpecialtyItem> {
    const res = await axiosInstance.put(`/admin/clinic/specialties/${id}`, data)
    return res.data.data
  },

  async toggleSpecialty(id: string): Promise<SpecialtyItem> {
    const res = await axiosInstance.patch(`/admin/clinic/specialties/${id}/toggle`)
    return res.data.data
  },

  // ---- Upload Ảnh ----
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('image', file)
    const res = await axiosInstance.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data.data.url
  }
}
