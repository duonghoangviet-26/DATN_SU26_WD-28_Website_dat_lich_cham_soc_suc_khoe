import { io, type Socket } from 'socket.io-client'

type RealtimeEvent =
  | 'admin:appointment_created'
  | 'admin:appointment_updated'
  | 'admin:payment_updated'

type RealtimePayload = {
  emitted_at?: string
  [key: string]: unknown
}

type RealtimeHandler = (payload: RealtimePayload) => void

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, '')

let socket: Socket | null = null

function getSocket() {
  const token = localStorage.getItem('token')

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  } else {
    socket.auth = { token }
    if (!socket.connected) socket.connect()
  }

  return socket
}

export function subscribeAdminRealtime(handlers: Partial<Record<RealtimeEvent, RealtimeHandler>>) {
  const activeSocket = getSocket()

  Object.entries(handlers).forEach(([event, handler]) => {
    if (handler) activeSocket.on(event, handler)
  })

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => {
      if (handler) activeSocket.off(event, handler)
    })
  }
}

export function disconnectRealtime() {
  socket?.disconnect()
  socket = null
}
