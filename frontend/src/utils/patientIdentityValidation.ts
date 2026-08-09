const PHONE_PATTERN = /^0\d{9}$/
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*[\p{L}]$/u
const MIN_AGE_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 10)
}

export function normalizePersonName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function getLatestAllowedBirthDate(today = new Date()) {
  const base = startOfDay(today)
  base.setDate(base.getDate() - MIN_AGE_DAYS)
  return base
}

export function getLatestAllowedBirthDateInput(today = new Date()) {
  const latestAllowedBirthDate = getLatestAllowedBirthDate(today)
  const year = latestAllowedBirthDate.getFullYear()
  const month = String(latestAllowedBirthDate.getMonth() + 1).padStart(2, '0')
  const day = String(latestAllowedBirthDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function validateVietnamesePhone(value: string) {
  const normalized = normalizePhoneInput(value)
  if (!normalized) {
    return 'Vui lòng nhập số điện thoại.'
  }
  if (!PHONE_PATTERN.test(normalized)) {
    return 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'
  }
  return ''
}

export function validatePatientName(value: string) {
  const normalized = normalizePersonName(value)
  if (!normalized) {
    return 'Vui lòng nhập họ tên.'
  }
  if (normalized.length < 2) {
    return 'Họ tên phải có ít nhất 2 ký tự.'
  }
  if (normalized.length > 80) {
    return 'Họ tên không được vượt quá 80 ký tự.'
  }
  if (!NAME_PATTERN.test(normalized)) {
    return 'Họ tên chỉ được chứa chữ cái và khoảng trắng hợp lệ.'
  }
  return ''
}

export function validateBirthDate(value: string, today = new Date()) {
  if (!value) return ''
  const birthDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) {
    return 'Ngày sinh không hợp lệ.'
  }

  const todayStart = startOfDay(today)
  if (birthDate > todayStart) {
    return 'Ngày sinh không được ở tương lai.'
  }

  const latestAllowedBirthDate = getLatestAllowedBirthDate(today)
  if (birthDate > latestAllowedBirthDate) {
    return `Ngày sinh phải cách hôm nay ít nhất ${MIN_AGE_DAYS} ngày.`
  }

  const ageInDays = Math.floor((todayStart.getTime() - birthDate.getTime()) / MS_PER_DAY)
  if (ageInDays > 120 * 365) {
    return 'Ngày sinh không hợp lệ.'
  }

  return ''
}
