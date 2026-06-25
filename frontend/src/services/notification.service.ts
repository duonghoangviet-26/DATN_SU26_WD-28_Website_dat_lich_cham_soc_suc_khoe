import { mockNotifications } from '@/mock/notifications'
import type { NotificationItem, NotificationTarget } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

const RECIPIENT_COUNT: Record<NotificationTarget, number> = {
  tat_ca: 1248,
  benh_nhan: 1162,
  bac_si: 86,
}

let notifications = [...mockNotifications]
let nextId = notifications.length + 1

interface SendPayload {
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTarget
}

export const notificationService = {
  async getAll(): Promise<NotificationItem[]> {
    await delay()
    return [...notifications].reverse()
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<NotificationItem[]>>('/admin/notifications')
    // return res.data.data
  },

  async send(payload: SendPayload): Promise<NotificationItem> {
    await delay()
    const newItem: NotificationItem = {
      id: nextId++,
      tieu_de: payload.tieu_de,
      noi_dung: payload.noi_dung,
      doi_tuong: payload.doi_tuong,
      so_nguoi_nhan: RECIPIENT_COUNT[payload.doi_tuong] ?? 0,
      ngay_gui: new Date().toISOString(),
    }
    notifications = [newItem, ...notifications]
    return newItem
    // Real API:
    // const res = await axiosInstance.post<ApiResponse<NotificationItem>>('/admin/notifications', payload)
    // return res.data.data
  },
}
