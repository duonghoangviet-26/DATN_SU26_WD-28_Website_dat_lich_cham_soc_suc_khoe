// ============================================================
// SERVICE: Quản lý người dùng (chức năng C1 của Admin)
// ============================================================
import type { User, ApiResponse } from '@/types'
import axios from './axiosInstance'

interface UserFilters {
  keyword?: string
  role?: string
  status?: string
  page?: number
  limit?: number
}

interface PaginationData {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface UserListResponse {
  success: boolean
  message: string
  data: User[]
  pagination: PaginationData
}

export const userService = {
  // Lấy danh sách người dùng — có phân trang + lọc
  async getAll(params: UserFilters = {}): Promise<UserListResponse> {
    const { data } = await axios.get('/admin/users', { params })
    return data
  },

  // Lấy chi tiết một người dùng
  async getById(id: string): Promise<User> {
    const { data } = await axios.get(`/admin/users/${id}`)
    return data.data
  },

  // Admin tạo user mới
  async create(userData: Partial<User>): Promise<User> {
    const { data } = await axios.post('/admin/users', userData)
    return data.data
  },

  // Cập nhật thông tin (ho_ten, so_dien_thoai, role, status)
  async update(id: string, userData: Partial<User>): Promise<User> {
    const { data } = await axios.put(`/admin/users/${id}`, userData)
    return data.data
  },

  // Khóa / mở khóa một tài khoản
  async toggleStatus(id: string): Promise<User> {
    const { data } = await axios.patch(`/admin/users/${id}/toggle-lock`)
    return data.data
  },

  // Xóa mềm người dùng
  async softDelete(id: string): Promise<void> {
    await axios.patch(`/admin/users/${id}/delete`)
  },

  // Khôi phục người dùng đã xóa
  async restore(id: string): Promise<User> {
    const { data } = await axios.patch(`/admin/users/${id}/restore`)
    return data.data
  },

  // Lấy thống kê người dùng
  async getStatistics(): Promise<any> {
    const { data } = await axios.get('/admin/users/statistics')
    return data.data
  },

  // Xóa vĩnh viễn người dùng (trong thùng rác)
  async hardDelete(id: string): Promise<void> {
    await axios.delete(`/admin/users/${id}/permanently`)
  },

  // Lấy nhật ký thao tác (Audit Logs)
  async getLogs(targetId?: string): Promise<any[]> {
    const { data } = await axios.get('/admin/users/logs', { params: { targetId } })
    return data.data
  }
}
