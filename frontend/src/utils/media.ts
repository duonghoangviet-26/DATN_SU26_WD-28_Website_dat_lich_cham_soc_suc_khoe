const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

/** Chuẩn hóa URL ảnh trả về từ API, kể cả khi backend lưu đường dẫn tương đối. */
export function resolveMediaUrl(value?: string | null) {
  if (!value) return null
  if (/^(https?:|data:|blob:)/i.test(value)) return value

  const origin = apiBaseUrl.replace(/\/api\/?$/, '')
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`
}
