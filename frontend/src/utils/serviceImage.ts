import type { ServiceItem } from '@/types'

const DEFAULT_SERVICE_IMAGES = [
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
]

/**
 * Tra cứu ảnh dịch vụ y tế. Nếu DB có hinh_anh sẽ lấy trực tiếp s.hinh_anh,
 * nếu chưa có sẽ tự động khớp ảnh y khoa chuyên sâu chuẩn HD.
 */
export function getServiceImage(service?: Partial<ServiceItem> | null, index = 0): string {
  if (!service) return DEFAULT_SERVICE_IMAGES[0]

  if (service.hinh_anh && service.hinh_anh.trim().length > 0) {
    return service.hinh_anh
  }

  const nameLower = (service.ten || '').toLowerCase()
  if (nameLower.includes('nội soi') || nameLower.includes('soi')) {
    return DEFAULT_SERVICE_IMAGES[0]
  }
  if (nameLower.includes('rửa') || nameLower.includes('xoang') || nameLower.includes('mũi')) {
    return DEFAULT_SERVICE_IMAGES[1]
  }
  if (nameLower.includes('nhi') || nameLower.includes('trẻ') || nameLower.includes('bé')) {
    return DEFAULT_SERVICE_IMAGES[2]
  }
  if (nameLower.includes('tai') || nameLower.includes('thính')) {
    return DEFAULT_SERVICE_IMAGES[3]
  }
  if (nameLower.includes('giọng') || nameLower.includes('thanh quản') || nameLower.includes('họng')) {
    return DEFAULT_SERVICE_IMAGES[5]
  }

  const idx = Math.abs(index) % DEFAULT_SERVICE_IMAGES.length
  return DEFAULT_SERVICE_IMAGES[idx]
}
