// Regex-based intent parser for chatbot

export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

export const parseDoctorIntent = (text: string, doctorNames: string[]): string | null => {
  const normText = normalizeString(text)
  // Check if text mentions a specific doctor from the list
  for (const name of doctorNames) {
    if (normText.includes(normalizeString(name))) {
      return name
    }
  }
  return null
}

export const parseDateTimeIntent = (text: string): { date?: string; timeOfDay?: 'morning' | 'afternoon' | 'evening'; hour?: string } | null => {
  const normText = normalizeString(text)
  const result: { date?: string; timeOfDay?: 'morning' | 'afternoon' | 'evening'; hour?: string } = {}
  
  if (normText.includes('hom nay')) {
    result.date = 'today'
  } else if (normText.includes('ngay mai') || normText.includes('mai')) {
    result.date = 'tomorrow'
  }

  if (normText.includes('sang')) result.timeOfDay = 'morning'
  if (normText.includes('chieu')) result.timeOfDay = 'afternoon'
  if (normText.includes('toi')) result.timeOfDay = 'evening'
  
  const hourMatch = normText.match(/(\d{1,2})h/)
  if (hourMatch) {
    result.hour = hourMatch[1]
  }

  return Object.keys(result).length > 0 ? result : null
}

export const parsePriceIntent = (text: string): { maxPrice?: number; exactPrice?: number } | null => {
  const normText = normalizeString(text)
  const match = normText.match(/duoi (\d+)(tr|k| trieu| ngan)/)
  if (match) {
    let val = parseInt(match[1])
    if (match[2].includes('tr')) val *= 1000000
    else if (match[2].includes('k') || match[2].includes('ngan')) val *= 1000
    return { maxPrice: val }
  }
  return null
}

export const parseListServicesIntent = (text: string): boolean => {
  const normText = normalizeString(text)
  return normText.includes('dich vu') || normText.includes('kham gi')
}

export const parseServiceIntent = (text: string): string | null => {
  const normText = normalizeString(text)
  const services = ['kham tai', 'kham mui', 'kham hong', 'noi soi', 'xet nghiem']
  for (const s of services) {
    if (normText.includes(s)) return s
  }
  return null
}

export const parseNavigationIntent = (text: string): 'booking' | 'doctors' | 'profile' | 'admin' | null => {
  const normText = normalizeString(text)
  if (normText.includes('dat lich') || normText.includes('kham benh')) return 'booking'
  if (normText.includes('xem bac si')) return 'doctors'
  if (normText.includes('ho so benh an')) return 'profile'
  if (normText.includes('trang quan tri')) return 'admin'
  return null
}

export const parseHowToBookIntent = (text: string): boolean => {
  const normText = normalizeString(text)
  const isAskingHow = normText.includes('lam the nao') || normText.includes('lam sao') || normText.includes('lam nhu nao') || normText.includes('cach') || normText.includes('huong dan')
  const isBooking = normText.includes('dat lich') || normText.includes('kham benh')
  return isAskingHow && isBooking
}

export const parseAdminReportIntent = (text: string): 'revenue_today' | 'revenue_month' | 'appointments_status' | null => {
  const normText = normalizeString(text)
  if (normText.includes('doanh thu hom nay')) return 'revenue_today'
  if (normText.includes('doanh thu') && normText.includes('thang')) return 'revenue_month'
  if (normText.includes('lich kham') && (normText.includes('trang thai') || normText.includes('chua xac nhan'))) return 'appointments_status'
  return null
}

export const parseGeneralAvailabilityIntent = (text: string): boolean => {
  const normText = normalizeString(text)
  return !!normText.match(/(bac si nao ranh|ai ranh|con bac si nao|phong nao trong|lich nao trong|kham duoc khong|phong trong|lich trong|con lich)/)
}
