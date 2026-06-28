import type { User } from '@/types'

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@vitafamily.vn',
    ho_ten: 'Quản trị viên',
    role: 'admin',
    status: 'active',
    ngay_tao: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'doctor@vitafamily.vn',
    ho_ten: 'BS. Lê Hoàng Cường',
    role: 'doctor',
    status: 'active',
    ngay_tao: '2024-01-10T00:00:00Z',
  },
  {
    id: '3',
    email: 'user@vitafamily.vn',
    ho_ten: 'Nguyễn Văn An',
    role: 'user',
    status: 'active',
    ngay_tao: '2024-02-01T00:00:00Z',
  },
]
