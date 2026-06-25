import { mockUsers } from '@/mock/users'
import type { User } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let users = [...mockUsers]

interface UserFilters {
  keyword?: string
  role?: string
  status?: string
}

export const userService = {
  async getAll({ keyword = '', role = '', status = '' }: UserFilters = {}): Promise<User[]> {
    await delay()
    let list = [...users]
    if (keyword) {
      const q = keyword.toLowerCase()
      list = list.filter(u => u.ho_ten.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    if (role)   list = list.filter(u => u.role === role)
    if (status) list = list.filter(u => u.status === status)
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (keyword) params.keyword = keyword
    // if (role)    params.role    = role
    // if (status)  params.status  = status
    // const res = await axiosInstance.get<ApiResponse<User[]>>('/admin/users', { params })
    // return res.data.data
  },

  async toggleLock(id: string): Promise<User> {
    await delay()
    const user = users.find(u => u.id === id)
    if (!user) throw new Error('Không tìm thấy người dùng')
    user.status = user.status === 'active' ? 'locked' : 'active'
    return { ...user }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<User>>(`/admin/users/${id}/toggle-lock`)
    // return res.data.data
  },
}
