import axiosInstance from './axiosInstance'
import type { NotificationItemAPI, NotificationTargetAPI } from '@/types'

interface SendPayloadAPI {
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTargetAPI
}

export const notificationService = {
  async getAll(page = 1, limit = 10): Promise<{ data: NotificationItemAPI[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axiosInstance.get('/admin/notifications', { params: { page, limit } })
    return {
      data: data.data,
      pagination: data.pagination
    }
  },

  async getReceived(page = 1, limit = 10): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axiosInstance.get('/admin/notifications/received', { params: { page, limit } })
    return {
      data: data.data,
      pagination: data.pagination
    }
  },

  async send(payload: SendPayloadAPI): Promise<NotificationItemAPI> {
    const { data } = await axiosInstance.post('/admin/notifications', payload)
    return data.data
  },

  async update(id: string, payload: { tieu_de: string; noi_dung: string }): Promise<NotificationItemAPI> {
    const { data } = await axiosInstance.put(`/admin/notifications/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<boolean> {
    await axiosInstance.delete(`/admin/notifications/${id}`)
    return true
  },

  async markAsRead(id: string): Promise<boolean> {
    await axiosInstance.put(`/admin/notifications/received/${id}/read`)
    return true
  },

  async getLogs(id: string): Promise<any[]> {
    const { data } = await axiosInstance.get(`/admin/notifications/${id}/logs`)
    return data.data
  },
}
