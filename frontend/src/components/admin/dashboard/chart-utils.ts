export function clinicDate(daysFromToday = 0) {
  const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function clinicMonth() {
  return clinicDate().slice(0, 7)
}

export function clinicYear() {
  return clinicDate().slice(0, 4)
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

export function formatShortDate(value: string) {
  const [, month, day] = value.split('-')
  return `${day}/${month}`
}

export function getErrorMessage(error: any) {
  return error?.response?.data?.message || error?.message || 'Không thể tải dữ liệu thống kê'
}
