import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

let io = null
const DASHBOARD_REVENUE_TYPES = new Set(['thanh_toan', 'hoa_don'])

function clinicDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function clinicMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: 'numeric',
  }).format(date))
}

function parseAllowedOrigins() {
  const configured = process.env.SOCKET_CORS_ORIGINS || process.env.FRONTEND_URL || ''
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return origins.length > 0 ? origins : ['http://localhost:5173', 'http://127.0.0.1:5173']
}

function verifySocketUser(socket) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) return null

  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

export function initRealtime(server) {
  io = new Server(server, {
    cors: {
      origin: parseAllowedOrigins(),
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    const user = verifySocketUser(socket)

    if (user?.role === 'admin') {
      socket.join('admin')
    }

    socket.emit('realtime:ready', {
      connected: true,
      role: user?.role ?? null,
      at: new Date().toISOString(),
    })
  })

  return io
}

export function emitAdminRealtime(event, payload = {}) {
  if (!io) return

  io.to('admin').emit(event, {
    ...payload,
    emitted_at: new Date().toISOString(),
  })
}

export function emitDashboardRevenueChanged({ ngay = new Date(), so_tien = 0, loai }) {
  if (!DASHBOARD_REVENUE_TYPES.has(loai)) return
  emitAdminRealtime('thongke:doanh_thu_thay_doi', {
    ngay: clinicDate(ngay),
    so_tien: Number(so_tien) || 0,
    loai,
  })
}

export function emitDashboardAppointmentChanged(trang_thai_cu, trang_thai_moi) {
  if (!trang_thai_cu || !trang_thai_moi || trang_thai_cu === trang_thai_moi) return
  emitAdminRealtime('thongke:lich_hen_thay_doi', { trang_thai_cu, trang_thai_moi })
}

export function emitDashboardNewPatient(ngayTao = new Date()) {
  emitAdminRealtime('thongke:benh_nhan_moi', { thang: clinicMonth(ngayTao) })
}

export function getRealtimeServer() {
  return io
}
