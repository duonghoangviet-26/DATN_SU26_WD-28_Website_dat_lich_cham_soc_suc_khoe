import axiosInstance from './axiosInstance'
import type { AdminNewsListResult, NewsArticle, NewsListResult, NewsPayload } from '@/types'

interface NewsQuery {
  keyword?: string
  status?: string
  page?: number
  limit?: number
}

async function uploadNewsImage(endpoint: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await axiosInstance.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data.url
}

export const newsService = {
  async getPublished(params: NewsQuery = {}): Promise<NewsListResult> {
    const res = await axiosInstance.get('/news', { params })
    return res.data.data
  },

  async getPublishedDetail(slug: string): Promise<{ article: NewsArticle; related: NewsArticle[] }> {
    const res = await axiosInstance.get(`/news/${slug}`)
    return res.data.data
  },

  async getAdminList(params: NewsQuery = {}): Promise<AdminNewsListResult> {
    const res = await axiosInstance.get('/admin/news', { params })
    return res.data.data
  },

  async getAdminDetail(id: string): Promise<NewsArticle> {
    const res = await axiosInstance.get(`/admin/news/${id}`)
    return res.data.data
  },

  async createAdmin(payload: NewsPayload): Promise<NewsArticle> {
    const res = await axiosInstance.post('/admin/news', payload)
    return res.data.data
  },

  async updateAdmin(id: string, payload: NewsPayload): Promise<NewsArticle> {
    const res = await axiosInstance.put(`/admin/news/${id}`, payload)
    return res.data.data
  },

  async toggleAdmin(id: string): Promise<NewsArticle> {
    const res = await axiosInstance.patch(`/admin/news/${id}/toggle`)
    return res.data.data
  },

  async deleteAdmin(id: string): Promise<void> {
    await axiosInstance.delete(`/admin/news/${id}`)
  },

  async createReceptionist(payload: NewsPayload): Promise<NewsArticle> {
    const res = await axiosInstance.post('/receptionist/news', payload)
    return res.data.data
  },

  async getReceptionistList(params: NewsQuery = {}): Promise<NewsListResult> {
    const res = await axiosInstance.get('/receptionist/news', { params })
    return res.data.data
  },

  async getReceptionistDetail(id: string): Promise<NewsArticle> {
    const res = await axiosInstance.get(`/receptionist/news/${id}`)
    return res.data.data
  },

  async updateReceptionist(id: string, payload: NewsPayload): Promise<NewsArticle> {
    const res = await axiosInstance.put(`/receptionist/news/${id}`, payload)
    return res.data.data
  },

  async getAdminHistory(id: string): Promise<any[]> {
    const res = await axiosInstance.get(`/admin/news/${id}/history`)
    return res.data.data
  },

  async getReceptionistHistory(id: string): Promise<any[]> {
    const res = await axiosInstance.get(`/receptionist/news/${id}/history`)
    return res.data.data
  },

  uploadAdminImage(file: File): Promise<string> {
    return uploadNewsImage('/admin/news/upload', file)
  },

  uploadReceptionistImage(file: File): Promise<string> {
    return uploadNewsImage('/receptionist/news/upload', file)
  },
}
