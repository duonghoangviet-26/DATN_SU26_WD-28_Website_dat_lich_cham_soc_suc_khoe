// Định dạng tiền tệ VND: 150000 -> "150.000 ₫"
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value)
}

// Định dạng ngày: "2026-06-11" -> "11/06/2026"
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

// Định dạng ngày + giờ: -> "11/06/2026 14:30"
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Trả về chuỗi 'YYYY-MM-DD' theo múi giờ LOCAL (không dùng toISOString — đó là UTC)
// Dùng thay cho new Date().toISOString().slice(0,10) để tránh lệch ngày từ 00:00–07:00 VN (+7)
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Trả về Promise chờ một khoảng (ms) — giả lập độ trễ mạng cho mock data
export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Tìm item theo id trong mảng, throw Error nếu không thấy (dùng trong mock services)
export function findOrThrow<T extends { id: number }>(list: T[], id: number, label = 'Bản ghi'): T {
  const found = list.find((x) => x.id === id)
  if (!found) throw new Error(`${label} với id=${id} không tồn tại`)
  return found
}
