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

  // ---- Chuyên Khoa của từng chi nhánh ----

  async getSpecialties(clinicId: string): Promise<SpecialtyItem[]> {
    const res = await axiosInstance.get(`/admin/clinic-info/${clinicId}/specialties`)
    return res.data.data
  },

  async createSpecialty(clinicId: string, payload: Partial<SpecialtyItem>): Promise<SpecialtyItem> {
    const res = await axiosInstance.post(`/admin/clinic-info/${clinicId}/specialties`, payload)
    return res.data.data
  },

  async updateSpecialty(id: string, payload: Partial<SpecialtyItem>): Promise<SpecialtyItem> {
    const res = await axiosInstance.put(`/admin/clinic-info/specialties/${id}`, payload)
    return res.data.data
  },

  async toggleSpecialtyStatus(id: string): Promise<SpecialtyItem> {
    const res = await axiosInstance.patch(`/admin/clinic-info/specialties/${id}/toggle`)
    return res.data.data
  },

  async copySpecialty(specialtyId: string, targetClinicIds: string[]): Promise<{ message: string }> {
    const res = await axiosInstance.post(`/admin/clinic-info/specialties/${specialtyId}/copy`, { targetClinicIds })
    return { message: res.data.message }
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
