import { mockDoctors } from '@/mock/doctors'
import type { DoctorProfile, DoctorApproval } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let doctors = [...mockDoctors]

export const doctorService = {
  async getAll(trang_thai?: DoctorApproval | '', search?: string): Promise<DoctorProfile[]> {
    await delay()
    let list = [...doctors]
    if (trang_thai) list = list.filter(d => d.trang_thai_duyet === trang_thai)
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d => d.ho_ten.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
    }
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (trang_thai) params.trang_thai = trang_thai
    // if (search?.trim()) params.search = search.trim()
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile[]>>('/admin/doctors', { params })
    // return res.data.data
  },

  async getById(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}`)
    // return res.data.data
  },

  async approve(id: string, phong_kham_mac_dinh?: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'approved'
    doc.ly_do_tu_choi = null
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/approve`, phong_kham_mac_dinh ? { phong_kham_mac_dinh } : {})
    // return res.data.data
  },

  async reject(id: string, ly_do: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'rejected'
    doc.ly_do_tu_choi = ly_do
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/reject`, { ly_do })
    // return res.data.data
  },

  async suspend(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'suspended'
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/suspend`)
    // return res.data.data
  },

  async assignRoom(id: string, phong_kham_mac_dinh: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/assign-room`, { phong_kham_mac_dinh })
    // return res.data.data
  },
}
