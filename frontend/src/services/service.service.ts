import type { ServiceItem, ServiceType } from '@/types'
import { mockServices } from '@/mock/services'
import { delay, findOrThrow } from '@/utils/format'

let services: ServiceItem[] = [...mockServices]

export const serviceService = {
  async getAll(loai?: ServiceType | ''): Promise<ServiceItem[]> {
    await delay()
    if (!loai) return [...services]
    return services.filter((s) => s.loai === loai)
  },

  async toggle(id: number): Promise<ServiceItem> {
    await delay(200)
    services = services.map((s) =>
      s.id === id ? { ...s, status: s.status === 'active' ? 'hidden' : 'active' } : s,
    )
    return findOrThrow(services, id, 'Dịch vụ')
  },
}
