import { useEffect, useState } from 'react'
import { userService } from '@/services/user.service'
import type { User } from '@/types'
import {
  ROLE_LABEL,
  USER_STATUS_LABEL,
  ROLES,
  USER_STATUS,
} from '@/utils/constants'
import { formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

// ============================================================
// TRANG MẪU: Quản lý người dùng (C1)
// ============================================================
// Đây là TRANG THAM KHẢO cho cả nhóm. Các trang Admin khác làm theo đúng cấu trúc này:
//   1. State: dữ liệu + bộ lọc + loading
//   2. Gọi service trong useEffect (KHÔNG gọi mock trực tiếp)
//   3. Render: PageHeader -> bộ lọc -> bảng dữ liệu -> hộp thoại xác nhận
// ============================================================

export default function ManageUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')

  const [confirmUser, setConfirmUser] = useState<User | null>(null)

  // Tải danh sách mỗi khi bộ lọc đổi
  useEffect(() => {
    let ignore = false
    setLoading(true)
    userService
      .getAll({ keyword, role, status })
      .then((data) => {
        if (!ignore) setUsers(data)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [keyword, role, status])

  // Xác nhận khóa / mở khóa
  async function handleToggleLock() {
    if (!confirmUser) return
    const target = confirmUser
    setConfirmUser(null)
    const updated = await userService.toggleLock(target.id)
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  return (
    <div>
      <PageHeader
        title="Quản lý người dùng"
        description="Xem, tìm kiếm và khóa/mở khóa tài khoản trong hệ thống."
      />

      {/* ----- Bộ lọc ----- */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ô tìm kiếm */}
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input pl-9"
              placeholder="Tìm theo tên hoặc email..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Lọc theo vai trò */}
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value={ROLES.USER}>Bệnh nhân</option>
            <option value={ROLES.DOCTOR}>Bác sĩ</option>
            <option value={ROLES.ADMIN}>Quản trị viên</option>
          </select>

          {/* Lọc theo trạng thái */}
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value={USER_STATUS.ACTIVE}>Hoạt động</option>
            <option value={USER_STATUS.LOCKED}>Đã khóa</option>
          </select>
        </div>
      </div>

      {/* ----- Bảng dữ liệu ----- */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Họ tên</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Số điện thoại</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {u.ho_ten.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{u.ho_ten}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.so_dien_thoai || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={u.role === 'doctor' ? 'blue' : u.role === 'admin' ? 'yellow' : 'gray'}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={u.status === 'active' ? 'green' : 'red'}>
                        {USER_STATUS_LABEL[u.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(u.ngay_tao)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => setConfirmUser(u)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            u.status === 'active'
                              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                              : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                          }`}
                        >
                          {u.status === 'active'
                            ? <><Icon name="ban" className="h-3 w-3" /> Khóa</>
                            : <><Icon name="check" className="h-3 w-3" /> Mở khóa</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tổng số */}
      {!loading && (
        <p className="mt-3 text-sm text-slate-500">
          Tổng cộng {users.length} người dùng
        </p>
      )}

      {/* Hộp thoại xác nhận khóa/mở khóa */}
      <ConfirmDialog
        open={!!confirmUser}
        danger={confirmUser?.status === 'active'}
        title={confirmUser?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={
          confirmUser
            ? `Bạn có chắc muốn ${
                confirmUser.status === 'active' ? 'khóa' : 'mở khóa'
              } tài khoản "${confirmUser.ho_ten}"?`
            : ''
        }
        confirmText={confirmUser?.status === 'active' ? 'Khóa' : 'Mở khóa'}
        onConfirm={handleToggleLock}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  )
}
