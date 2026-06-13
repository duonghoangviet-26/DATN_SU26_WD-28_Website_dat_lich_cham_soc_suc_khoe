import type { DoctorProfile, DoctorApproval } from '@/types'
import { mockDoctors } from '@/mock/doctors'
import { delay, findOrThrow } from '@/utils/format'

let doctors: DoctorProfile[] = [...mockDoctors]

export const doctorService = {
  async getAll(trang_thai?: DoctorApproval | ''): Promise<DoctorProfile[]> {
    await delay()
    // SAU NÀY: const { data } = await axios.get('/admin/doctors', { params: { trang_thai } })
    if (!trang_thai) return [...doctors]
    return doctors.filter((d) => d.trang_thai_duyet === trang_thai)
  },

  async approve(id: number): Promise<DoctorProfile> {
    await delay(200)
    // SAU NÀY: const { data } = await axios.patch(`/admin/doctors/${id}/approve`)
    doctors = doctors.map((d) => d.id === id ? { ...d, trang_thai_duyet: 'approved' } : d)
    return findOrThrow(doctors, id, 'Bác sĩ')
  },

  async reject(id: number, ly_do: string): Promise<DoctorProfile> {
    await delay(200)
    // SAU NÀY: const { data } = await axios.patch(`/admin/doctors/${id}/reject`, { ly_do })
    doctors = doctors.map((d) =>
      d.id === id ? { ...d, trang_thai_duyet: 'rejected', ly_do_tu_choi: ly_do } : d,
    )
    return findOrThrow(doctors, id, 'Bác sĩ')
  },

  async suspend(id: number): Promise<DoctorProfile> {
    await delay(200)
    // SAU NÀY: const { data } = await axios.patch(`/admin/doctors/${id}/suspend`)
    doctors = doctors.map((d) => d.id === id ? { ...d, trang_thai_duyet: 'suspended' } : d)
    return findOrThrow(doctors, id, 'Bác sĩ')
  },

  async restore(id: number): Promise<DoctorProfile> {
    await delay(200)
    // SAU NÀY: const { data } = await axios.patch(`/admin/doctors/${id}/restore`)
    doctors = doctors.map((d) => d.id === id ? { ...d, trang_thai_duyet: 'approved' } : d)
    return findOrThrow(doctors, id, 'Bác sĩ')
  },
}
