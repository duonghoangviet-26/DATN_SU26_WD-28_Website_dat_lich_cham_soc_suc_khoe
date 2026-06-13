import type { HospitalItem, SpecialtyItem } from '@/types'
import { mockHospitals, mockSpecialties } from '@/mock/hospitals'
import { delay, findOrThrow } from '@/utils/format'

let hospitals: HospitalItem[] = [...mockHospitals]
let specialties: SpecialtyItem[] = [...mockSpecialties]

export const hospitalService = {
  async getHospitals(): Promise<HospitalItem[]> {
    await delay()
    return [...hospitals]
  },

  async toggleHospital(id: number): Promise<HospitalItem> {
    await delay(200)
    hospitals = hospitals.map((h) =>
      h.id === id ? { ...h, status: h.status === 'active' ? 'hidden' : 'active' } : h,
    )
    return findOrThrow(hospitals, id, 'Bệnh viện')
  },

  async getSpecialties(): Promise<SpecialtyItem[]> {
    await delay()
    return [...specialties]
  },

  async toggleSpecialty(id: number): Promise<SpecialtyItem> {
    await delay(200)
    specialties = specialties.map((s) =>
      s.id === id ? { ...s, status: s.status === 'active' ? 'hidden' : 'active' } : s,
    )
    return findOrThrow(specialties, id, 'Chuyên khoa')
  },
}
