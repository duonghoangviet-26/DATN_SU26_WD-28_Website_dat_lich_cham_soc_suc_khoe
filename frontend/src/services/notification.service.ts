import type { NotificationItem, NotificationTarget } from '@/types'
import { mockNotifications } from '@/mock/notifications'
import { delay } from '@/utils/format'

let notifications: NotificationItem[] = [...mockNotifications]
let nextId = notifications.length + 1

interface SendPayload {
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTarget
}

const RECIPIENT_COUNT: Record<NotificationTarget, number> = {
  all: 1248,
  user: 1162,
  doctor: 86,
}

export const notificationService = {
  async getAll(): Promise<NotificationItem[]> {
    await delay()
    return [...notifications]
  },

  async send(payload: SendPayload): Promise<NotificationItem> {
    await delay(500)
    const newItem: NotificationItem = {
      id: nextId++,
      ...payload,
      so_nguoi_nhan: RECIPIENT_COUNT[payload.doi_tuong],
      ngay_gui: new Date().toISOString(),
    }
    notifications = [newItem, ...notifications]
    return newItem
  },
}
