// ============================================================
// SERVICE: Quản lý người dùng (chức năng C1 của Admin)
// ============================================================
// ĐÂY LÀ FILE MẪU cho cả nhóm. Mọi page CHỈ gọi service, KHÔNG đụng mock trực tiếp.
//
// Cách hoạt động:
//   - Bây giờ:  trả về dữ liệu mock (fix cứng) sau một khoảng delay giả lập mạng.
//   - Sau này:  chỉ cần thay phần thân hàm bằng lời gọi axios (đã có ví dụ trong comment),
//               UI và page KHÔNG cần sửa gì.
// ============================================================

import type { User } from '@/types'
import { mockUsers } from '@/mock/users'
import { delay } from '@/utils/format'
// import axios from './axiosInstance'   // ← bật khi có backend thật

interface UserFilters {
  keyword?: string
  role?: string
  status?: string
}

// Bản sao mock để có thể "khóa / mở khóa" trong bộ nhớ (giả lập thay đổi dữ liệu)
let users: User[] = [...mockUsers]

export const userService = {
  // Lấy danh sách người dùng — có hỗ trợ tìm kiếm + lọc theo vai trò / trạng thái
  async getAll({ keyword = '', role = '', status = '' }: UserFilters = {}): Promise<User[]> {
    await delay()

    // ── SAU NÀY thay toàn bộ khối dưới bằng:
    // const { data } = await axios.get('/admin/users', { params: { keyword, role, status } })
    // return data.data
    let result = [...users]

    if (keyword) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter(
        (u) =>
          u.ho_ten.toLowerCase().includes(kw) ||
          u.email.toLowerCase().includes(kw),
      )
    }
    if (role) result = result.filter((u) => u.role === role)
    if (status) result = result.filter((u) => u.status === status)

    return result
  },

  // Khóa / mở khóa một tài khoản (C1). Trả về user sau khi đổi trạng thái.
  async toggleLock(id: string): Promise<User> {
    await delay(200)

    // ── SAU NÀY thay bằng:
    // const { data } = await axios.patch(`/admin/users/${id}/toggle-lock`)
    // return data.data
    users = users.map((u): User =>
      u.id === id
        ? { ...u, status: u.status === 'active' ? 'locked' : 'active' }
        : u,
    )
    const updated = users.find((u) => u.id === id)
    if (!updated) throw new Error('Không tìm thấy người dùng')
    return updated
  },
}
