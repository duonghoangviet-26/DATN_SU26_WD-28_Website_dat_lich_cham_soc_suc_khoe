import { mockSpecialties } from '@/mock/hospitals'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

export interface SpecialtyOption {
  id: string
  ten: string
}

export const specialtyService = {
  async getAll(): Promise<SpecialtyOption[]> {
    await delay()
    return mockSpecialties
      .filter(s => s.status === 'active')
      .map(s => ({ id: String(s.id), ten: s.ten }))
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyOption[]>>('/admin/specialties')
    // return res.data.data
  },
}
