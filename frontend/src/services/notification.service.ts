import axios from 'axios'
import type { NotificationItemAPI, NotificationTargetAPI } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const BASE_URL = `${API_URL}/admin/notifications`

interface SendPayloadAPI {
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTargetAPI
  admin_id: string
}

export const notificationService = {
  async getAll(page = 1, limit = 10): Promise<{ data: NotificationItemAPI[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axios.get(BASE_URL, { params: { page, limit } })
    return {
      data: data.data,
      pagination: data.pagination
    }
  },

  async send(payload: SendPayloadAPI): Promise<NotificationItemAPI> {
    const { data } = await axios.post(BASE_URL, payload)
    return data.data
  },

  async update(id: string, payload: { tieu_de: string; noi_dung: string }): Promise<NotificationItemAPI> {
    const { data } = await axios.put(`${BASE_URL}/${id}`, payload)
    return data.data
  },
}
