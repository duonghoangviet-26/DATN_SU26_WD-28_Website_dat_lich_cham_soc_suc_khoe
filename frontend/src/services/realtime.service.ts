import { io, type Socket } from 'socket.io-client'

export type DashboardRevenuePayload = {
  ngay: string
  so_tien: number
  loai: 'thanh_toan' | 'hoa_don'
  emitted_at?: string
}

export type DashboardAppointmentPayload = {
  trang_thai_cu: string
  trang_thai_moi: string
  emitted_at?: string
}

export type DashboardPatientPayload = {
  thang: number
  emitted_at?: string
}

type RealtimeEvent =
  | 'admin:appointment_created'
  | 'admin:appointment_updated'
  | 'admin:payment_updated'
  | 'thongke:doanh_thu_thay_doi'
  | 'thongke:lich_hen_thay_doi'
  | 'thongke:benh_nhan_moi'

type RealtimeHandler = (payload: any) => void

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

export function subscribeRealtimeConnection({
  onConnect,
  onDisconnect,
}: {
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
}) {
  const activeSocket = getSocket()
  if (onConnect) activeSocket.on('connect', onConnect)
  if (onDisconnect) activeSocket.on('disconnect', onDisconnect)

  return () => {
    if (onConnect) activeSocket.off('connect', onConnect)
    if (onDisconnect) activeSocket.off('disconnect', onDisconnect)
  }
}

export function isRealtimeConnected() {
  return socket?.connected ?? false
}

export function disconnectRealtime() {
  socket?.disconnect()
  socket = null
}
