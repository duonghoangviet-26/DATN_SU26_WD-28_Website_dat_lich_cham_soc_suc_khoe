import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

let io = null

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

export function getRealtimeServer() {
  return io
}
