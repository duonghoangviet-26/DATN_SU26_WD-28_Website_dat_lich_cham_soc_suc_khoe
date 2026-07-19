import {
  getBenhNhanMoiTheoThang,
  getDichVuPhoBien,
  getDoanhThuTheoBacSi,
  getDoanhThuTheoNgay,
  getLichHenTheoTrangThai,
} from '../services/thong-ke.service.js'
import { fail, ok } from '../utils/response.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const YEAR_PATTERN = /^\d{4}$/

function clinicDayStart(value) {
  if (!DATE_PATTERN.test(value)) return null
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDateRange(query) {
  const start = query.tu ? clinicDayStart(query.tu) : undefined
  const inclusiveEnd = query.den ? clinicDayStart(query.den) : undefined

  if ((query.tu && !start) || (query.den && !inclusiveEnd)) {
    return { error: 'Tham số tu và den phải có định dạng YYYY-MM-DD' }
  }

  const end = inclusiveEnd
    ? new Date(inclusiveEnd.getTime() + 24 * 60 * 60 * 1000)
    : undefined

  if (start && end && start >= end) {
    return { error: 'Khoảng ngày không hợp lệ: tu phải nhỏ hơn hoặc bằng den' }
  }

  return { start, end }
}

function monthRange(value) {
  if (!MONTH_PATTERN.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  const start = new Date(`${value}-01T00:00:00+07:00`)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+07:00`)
  return { start, end }
}

function yearRange(value) {
  if (!YEAR_PATTERN.test(value)) return null
  const year = Number(value)
  return {
    start: new Date(`${year}-01-01T00:00:00+07:00`),
    end: new Date(`${year + 1}-01-01T00:00:00+07:00`),
  }
}

function currentClinicMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}

function currentClinicYear() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(new Date())
}

async function respond(res, loader, message) {
  try {
    return ok(res, await loader(), message)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function doanhThuTheoNgay(req, res) {
  const range = parseDateRange(req.query)
  if (range.error) return fail(res, 400, range.error)
  return respond(res, () => getDoanhThuTheoNgay(range), 'Thống kê doanh thu theo ngày')
}

export async function lichHenTheoTrangThai(req, res) {
  const range = parseDateRange(req.query)
  if (range.error) return fail(res, 400, range.error)
  return respond(res, () => getLichHenTheoTrangThai(range), 'Thống kê lịch hẹn theo trạng thái')
}

export async function doanhThuTheoBacSi(req, res) {
  const range = monthRange(req.query.thang || currentClinicMonth())
  if (!range) return fail(res, 400, 'Tham số thang phải có định dạng YYYY-MM')
  return respond(res, () => getDoanhThuTheoBacSi(range), 'Thống kê doanh thu theo bác sĩ')
}

export async function benhNhanMoiTheoThang(req, res) {
  const range = yearRange(req.query.nam || currentClinicYear())
  if (!range) return fail(res, 400, 'Tham số nam phải có định dạng YYYY')
  return respond(res, () => getBenhNhanMoiTheoThang(range), 'Thống kê bệnh nhân mới theo tháng')
}

export async function dichVuPhoBien(req, res) {
  const range = parseDateRange(req.query)
  if (range.error) return fail(res, 400, range.error)
  return respond(res, () => getDichVuPhoBien(range), 'Thống kê dịch vụ phổ biến')
}
