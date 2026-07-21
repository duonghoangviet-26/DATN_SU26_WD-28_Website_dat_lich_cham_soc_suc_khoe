import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { userService } from '@/services/user.service'
import { clinicService } from '@/services/clinic.service'
import { useAuth } from '@/context/AuthContext'
import type { User, Role } from '@/types'
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
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'

const LOG_CONFIG: Record<string, { label: string; color: 'green' | 'red' | 'blue' | 'yellow' | 'gray' }> = {
  CREATE_USER: {
    label: 'Tạo',
    color: 'green',
  },
  UPDATE_USER: {
    label: 'Cập nhật',
    color: 'blue',
  },
  SOFT_DELETE_USER: {
    label: 'Đã xóa',
    color: 'red',
  },
  RESTORE_USER: {
    label: 'Khôi phục',
    color: 'green',
  },
  LOCK_USER: {
    label: 'Khóa',
    color: 'yellow',
  },
  UNLOCK_USER: {
    label: 'Mở khóa',
    color: 'green',
  },
  HARD_DELETE_USER: {
    label: 'Xóa vĩnh viễn',
    color: 'red',
  },
}

// ============================================================
// TRANG: QUẢN LÝ NGƯỜI DÙNG (ADMIN) - HOÀN THIỆN 100%
// ============================================================

export default function ManageUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Lọc & Phân trang
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [isDeleted, setIsDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })

  // Modals state
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ type: 'lock' | 'delete' | 'restore' | 'hard-delete' | 'hard-delete-locked', user: User } | null>(null)
  const [detailLogs, setDetailLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // State thống kê ở đầu trang
  const [stats, setStats] = useState({
    total: 0,
    roles: { admin: 0, doctor: 0, user: 0 },
    status: { active: 0, locked: 0 },
    deleted: 0,
  })

  // Form state
  const [formData, setFormData] = useState<{
    ho_ten: string
    email: string
    mat_khau: string
    so_dien_thoai: string
    anh_dai_dien: string
    role: Role
  }>({ ho_ten: '', email: '', mat_khau: '', so_dien_thoai: '', anh_dai_dien: '', role: 'user' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await userService.getAll({ keyword, role, status, page, limit: 10, isDeleted: isDeleted ? 'true' : 'false' } as any)
      setUsers(res.data)
      setPagination(res.pagination)

      // Gọi song song API thống kê
      const statData = await userService.getStatistics()
      setStats(statData)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    setSelectedIds([]) // Reset chọn nhiều khi đổi bộ lọc
  }, [keyword, role, status, page, isDeleted])

  useEffect(() => {
    if (selectedUser) {
      setLoadingLogs(true)
      userService.getLogs(selectedUser.id)
        .then(logs => {
          setDetailLogs(logs)
        })
        .catch(err => {
          console.error('Không thể tải lịch sử thao tác:', err)
          setDetailLogs([])
        })
        .finally(() => {
          setLoadingLogs(false)
        })
    } else {
      setDetailLogs([])
    }
  }, [selectedUser])

  // --- HANDLERS ---

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await userService.create(formData)
      setShowAddModal(false)
      setFormData({ ho_ten: '', email: '', mat_khau: '', so_dien_thoai: '', anh_dai_dien: '', role: 'user' })
      loadUsers()
      window.dispatchEvent(new Event('RELOAD_NOTIFICATIONS'))
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi khi tạo')
    } finally { setSubmitting(false) }
  }

  const handleAvatarUpload = async (file: File | undefined, mode: 'add' | 'edit') => {
    if (!file) return

    setUploadingAvatar(true)
    setFormError('')
    try {
      const url = await clinicService.uploadImage(file)
      if (mode === 'add') {
        setFormData(prev => ({ ...prev, anh_dai_dien: url }))
      } else {
        setEditingUser(prev => prev ? { ...prev, anh_dai_dien: url } : prev)
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err.message || 'Tải ảnh đại diện thất bại')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setSubmitting(true)
    try {
      await userService.update(editingUser.id, editingUser)
      setEditingUser(null)
      loadUsers()
      window.dispatchEvent(new Event('RELOAD_NOTIFICATIONS'))
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi khi cập nhật')
    } finally { setSubmitting(false) }
  }

  const onConfirmAction = async () => {
    if (!confirmAction) return
    const { type, user } = confirmAction
    setConfirmAction(null)
    try {
      if (type === 'lock') {
        await userService.toggleStatus(user.id)
      } else if (type === 'delete') {
        await userService.softDelete(user.id)
      } else if (type === 'restore') {
        await userService.restore(user.id)
      } else if (type === 'hard-delete' || type === 'hard-delete-locked') {
        await userService.hardDelete(user.id)
      }
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Thao tác thất bại')
    }
  }

  const handleBatchAction = async (action: 'lock' | 'unlock' | 'delete' | 'restore' | 'hard-delete') => {
    if (selectedIds.length === 0) return

    const actionNames: Record<string, string> = {
      lock: 'khóa',
      unlock: 'mở khóa',
      delete: 'xóa',
      restore: 'khôi phục',
      'hard-delete': 'xóa vĩnh viễn'
    }

    let trimmedReason = ''
    if (action === 'hard-delete') {
      const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.length} người dùng đã chọn khỏi cơ sở dữ liệu? Thao tác này không thể phục hồi!`)
      if (!confirmDelete) return
    } else if (action === 'unlock') {
      trimmedReason = ''
    } else {
      const reason = window.prompt(`Nhập lý do ${actionNames[action]} ${selectedIds.length} người dùng đã chọn (không bắt buộc):`, '')
      if (reason === null) return // Hủy bỏ
      trimmedReason = reason.trim()
    }

    setLoading(true)
    try {
      const res = await userService.batchAction({
        ids: selectedIds,
        action,
        ly_do: trimmedReason
      })
      alert(`Đã thực hiện thành công thao tác ${actionNames[action]} cho ${res.count} người dùng!`)
      setSelectedIds([])
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Thao tác hàng loạt thất bại.')
      setLoading(false)
    }
  }



  const getLogDescription = (log: any) => {
    if (log.mo_ta) return log.mo_ta

    switch (log.hanh_dong) {
      case 'CREATE_USER':
        return 'Tạo tài khoản'

      case 'UPDATE_USER':
        return 'Cập nhật thông tin'

      case 'SOFT_DELETE_USER':
        return 'Đã xóa người dùng vào thùng rác'

      case 'RESTORE_USER':
        return 'Khôi phục tài khoản'

      case 'LOCK_USER':
        return 'Khóa tài khoản'

      case 'UNLOCK_USER':
        return 'Mở khóa tài khoản'

      case 'HARD_DELETE_USER':
        return 'Xóa vĩnh viễn tài khoản khỏi hệ thống'

      default:
        return 'Thực hiện thao tác'
    }
  }

  const FIELD_LABELS: Record<string, string> = {
    ho_ten: 'Họ tên',
    email: 'Email',
    so_dien_thoai: 'Điện thoại',
    anh_dai_dien: 'Ảnh đại diện',
    role: 'Vai trò',
    status: 'Trạng thái',
    ngay_xoa: 'Trạng thái xóa',
  }

  const formatLogValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return 'Trống'
    if (field === 'role') return ROLE_LABEL[value as Role] || String(value)
    if (field === 'status') return USER_STATUS_LABEL[value as keyof typeof USER_STATUS_LABEL] || String(value)
    if (field === 'anh_dai_dien') return value ? 'Có ảnh' : 'Không có ảnh'
    if (typeof value === 'boolean') return value ? 'Có' : 'Không'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getChangedFields = (log: any) => {
    const oldData = log.du_lieu_cu || {}
    const newData = log.du_lieu_moi || {}
    const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    return keys.filter((key) => JSON.stringify(oldData[key] ?? null) !== JSON.stringify(newData[key] ?? null))
  }

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader title="Quản lý người dùng" description="Quản lý tài khoản, vai trò và trạng thái thành viên.">
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
          <Icon name="plus" className="h-4 w-4" /> Thêm người dùng
        </button>
      </PageHeader>

      {/* Thẻ thống kê tổng quan (Dashboard mini) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tổng tài khoản */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Tổng tài khoản</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Thành viên hệ thống</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-sm border border-blue-100/50">
            <Icon name="users" className="h-6 w-6" />
          </div>
        </div>

        {/* Bệnh nhân */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Bệnh nhân</p>
            <p className="text-2xl font-bold text-slate-800">{stats.roles.user}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Vai trò user</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 shadow-sm border border-emerald-100/50">
            <Icon name="check" className="h-6 w-6" />
          </div>
        </div>

        {/* Bác sĩ */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Bác sĩ</p>
            <p className="text-2xl font-bold text-slate-800">{stats.roles.doctor}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cần duyệt hồ sơ</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-500 shadow-sm border border-purple-100/50">
            <Icon name="doctor" className="h-6 w-6" />
          </div>
        </div>

        {/* Đã khóa */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Đã khóa</p>
            <p className="text-2xl font-bold text-red-600">{stats.status.locked}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tạm ngưng hoạt động</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500 shadow-sm border border-red-100/50">
            <Icon name="ban" className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className="input pl-10 w-full" placeholder="Tìm tên hoặc email..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
          </div>
          <div className="w-full md:w-48">
            <select className="input w-full" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
              <option value="">Tất cả vai trò</option>
              {Object.entries(ROLES).map(([key, val]) => <option key={val} value={val}>{ROLE_LABEL[val]}</option>)}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select className="input w-full" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Tất cả trạng thái</option>
              <option value={USER_STATUS.ACTIVE}>Hoạt động</option>
              <option value={USER_STATUS.LOCKED}>Đã khóa</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsDeleted(!isDeleted)
              setPage(1)
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm transition-all active:scale-95 border h-[38px] shrink-0 ${
              isDeleted
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100/80'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon
              name="trash"
              className={`h-4 w-4 ${isDeleted ? 'text-red-500' : 'text-slate-400'}`}
            />
            Thùng rác
          </button>
        </div>
      </div>

      {/* Lỗi */}
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 border border-red-100">
        <Icon name="ban" className="h-5 w-5" /> {error}
      </div>}

      {/* Thanh tác vụ hàng loạt */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Đã chọn <strong className="text-brand-600">{selectedIds.length}</strong> người dùng
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline"
            >
              Bỏ chọn tất cả
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDeleted ? (
              <>
                <button
                  onClick={() => handleBatchAction('restore')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Icon name="refresh-cw" className="h-3.5 w-3.5" />
                  Khôi phục hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('hard-delete')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Xóa vĩnh viễn hàng loạt
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleBatchAction('unlock')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Mở khóa hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('lock')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-white hover:bg-amber-600 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Icon name="ban" className="h-3.5 w-3.5" />
                  Khóa hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('delete')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Xóa hàng loạt
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bảng */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.length === users.filter(u => u.id !== currentUser?.id).length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(users.filter(u => u.id !== currentUser?.id).map((u) => u.id))
                      } else {
                        setSelectedIds([])
                      }
                    }}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Thành viên</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Vai trò</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">{isDeleted ? 'Ngày xóa' : 'Ngày tạo'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center"><div className="animate-pulse text-slate-400 font-medium">Đang tải dữ liệu...</div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Không tìm thấy người dùng phù hợp.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 w-12 text-center">
                      {u.id !== currentUser?.id ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, u.id])
                            } else {
                              setSelectedIds(selectedIds.filter((id) => id !== u.id))
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
                          {u.anh_dai_dien ? (
                            <img src={u.anh_dai_dien} alt={u.ho_ten} className="h-full w-full object-cover" />
                          ) : (
                            (u.ho_ten || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.ho_ten}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Badge color={u.role === 'admin' ? 'yellow' : u.role === 'doctor' ? 'blue' : 'gray'}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="px-4 py-4"><Badge color={u.status === 'active' ? 'green' : 'red'}>{USER_STATUS_LABEL[u.status]}</Badge></td>
                    <td className="px-4 py-4 text-slate-500">
                      <div className="text-xs font-medium text-slate-900">{formatDate(isDeleted ? u.ngay_xoa : u.ngay_tao)}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(isDeleted ? (u.ngay_xoa as any) : (u.ngay_tao as any)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSelectedUser(u)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Xem chi tiết"><Icon name="eye" className="h-4 w-4" /></button>

                        {!isDeleted ? (
                          <>
                            <button onClick={() => setEditingUser(u)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Chỉnh sửa"><Icon name="edit" className="h-4 w-4" /></button>
                            {u.id !== currentUser?.id && (
                              <>
                                {/* active → nút khóa + xóa mềm | locked → nút mở khóa + xóa cứng */}
                                {u.status === 'active' ? (
                                  <>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'lock', user: u })}
                                      className="p-2 rounded-lg transition-colors text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                                      title="Khóa tài khoản"
                                    >
                                      <Icon name="ban" className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setConfirmAction({ type: 'delete', user: u })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa mềm"><Icon name="trash" className="h-4 w-4" /></button>
                                  </>
                                ) : (
                                  /* Tài khoản đã khóa: mở khóa + xóa cứng */
                                  <>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'lock', user: u })}
                                      className="p-2 rounded-lg transition-colors text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                      title="Mở khóa tài khoản"
                                    >
                                      <Icon name="refresh-cw" className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'hard-delete-locked', user: u })}
                                      className="p-2 rounded-lg transition-colors text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      title="Xóa vĩnh viễn tài khoản đã khóa"
                                    >
                                      <Icon name="trash" className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {/* Icon khôi phục: dùng refresh-cw (↺) thay vì check (✓) */}
                            <button onClick={() => setConfirmAction({ type: 'restore', user: u })} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Khôi phục tài khoản"><Icon name="refresh-cw" className="h-4 w-4" /></button>
                            <button onClick={() => setConfirmAction({ type: 'hard-delete', user: u })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa vĩnh viễn"><Icon name="trash" className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
        <p className="text-sm text-slate-500">Hiển thị <span className="font-bold text-slate-700">{users.length}</span> / {pagination.total} người dùng</p>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn bg-white border shadow-sm px-4 py-1.5 disabled:opacity-50">Trước</button>
          <div className="px-4 font-bold text-sm">Trang {page} / {pagination.totalPages}</div>
          <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="btn bg-white border shadow-sm px-4 py-1.5 disabled:opacity-50">Sau</button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Modal Xem chi tiết */}
      {selectedUser && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Icon name="user" className="h-5 w-5 text-brand-600" /> Thông tin chi tiết
              </h3>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-6 flex-1">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-2xl">
                  {selectedUser.anh_dai_dien ? (
                    <img src={selectedUser.anh_dai_dien} alt={selectedUser.ho_ten} className="h-full w-full object-cover" />
                  ) : (
                    selectedUser.ho_ten?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{selectedUser.ho_ten}</h4>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
                <div><label className="text-xs text-slate-400 font-bold uppercase">Điện thoại</label><p className="text-sm font-bold text-slate-800">{selectedUser.so_dien_thoai || '—'}</p></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Vai trò</label><div><Badge color={selectedUser.role === 'admin' ? 'yellow' : selectedUser.role === 'doctor' ? 'blue' : 'gray'}>{ROLE_LABEL[selectedUser.role]}</Badge></div></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Trạng thái</label><div><Badge color={selectedUser.status === 'active' ? 'green' : 'red'}>{USER_STATUS_LABEL[selectedUser.status]}</Badge></div></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Ngày tham gia</label><p className="text-sm font-bold text-slate-800">{formatDate(selectedUser.ngay_tao)}</p></div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Icon name="clock" className="h-4 w-4 text-slate-500" /> Lịch sử hoạt động
                </h4>
                
                {loadingLogs ? (
                  <div className="py-8 text-center text-sm text-slate-400 animate-pulse">Đang tải lịch sử...</div>
                ) : detailLogs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Chưa có lịch sử hoạt động.</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {detailLogs.map((log: any) => {
                      const cfg = LOG_CONFIG[log.hanh_dong as keyof typeof LOG_CONFIG] || { label: log.hanh_dong, color: 'gray' }
                      const changedFields = getChangedFields(log)
                      return (
                        <div key={log._id} className="flex gap-3 text-sm bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          <div className="shrink-0"><Badge color={cfg.color}>{cfg.label}</Badge></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-700">{getLogDescription(log)}</p>
                            <div className="flex gap-1.5 mt-0.5 text-xs text-slate-400">
                              <span>Bởi: {log.nguoi_thuc_hien_id?.ho_ten || 'Hệ thống'}</span>
                              <span>•</span>
                              <span>{new Date(log.ngay_tao).toLocaleString('vi-VN')}</span>
                            </div>
                            {changedFields.length > 0 && (
                              <div className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-white p-2">
                                {changedFields.map((field) => (
                                  <div key={field} className="grid grid-cols-[92px_1fr] gap-2 text-xs">
                                    <span className="font-semibold text-slate-500">{FIELD_LABELS[field] || field}</span>
                                    <span className="min-w-0 text-slate-600">
                                      <span className="break-words text-red-500 line-through">{formatLogValue(field, log.du_lieu_cu?.[field])}</span>
                                      <span className="mx-1 text-slate-300">→</span>
                                      <span className="break-words font-semibold text-emerald-600">{formatLogValue(field, log.du_lieu_moi?.[field])}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t flex gap-3">
              <button onClick={() => setSelectedUser(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition-colors">Đóng lại</button>
              {!isDeleted && (
                <button onClick={() => { setEditingUser(selectedUser); setSelectedUser(null); }} className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-colors">Chỉnh sửa</button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Thêm */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleAddSubmit} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-xl font-bold mb-4">Thêm thành viên mới</h3>
            {formError && <div className="mb-4 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">{formError}</div>}
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">
                  {formData.anh_dai_dien ? (
                    <img src={formData.anh_dai_dien} alt={formData.ho_ten || 'Avatar'} className="h-full w-full object-cover" />
                  ) : (
                    (formData.ho_ten || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-xs font-bold">Ảnh đại diện</label>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700">
                      <Icon name="image" className="h-3.5 w-3.5" />
                      {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={(e) => {
                          handleAvatarUpload(e.target.files?.[0], 'add')
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {formData.anh_dai_dien && (
                      <button type="button" onClick={() => setFormData({ ...formData, anh_dai_dien: '' })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white">
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div><label className="text-xs font-bold mb-1 block">Họ tên *</label><input required className="input" value={formData.ho_ten} onChange={e => setFormData({ ...formData, ho_ten: e.target.value })} /></div>
              <div><label className="text-xs font-bold mb-1 block">Email *</label><input required type="email" className="input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-xs font-bold mb-1 block">Mật khẩu *</label><input required type="password" className="input" value={formData.mat_khau} onChange={e => setFormData({ ...formData, mat_khau: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold mb-1 block">Điện thoại</label><input className="input" value={formData.so_dien_thoai} onChange={e => setFormData({ ...formData, so_dien_thoai: e.target.value })} /></div>
                <div><label className="text-xs font-bold mb-1 block">Vai trò</label><select className="input" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as Role })}><option value="user">Bệnh nhân</option><option value="doctor">Bác sĩ</option><option value="admin">Admin</option></select></div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button disabled={submitting} type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">Hủy</button>
              <button disabled={submitting} type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Lưu người dùng'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Modal Sửa */}
      {editingUser && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleEditSubmit} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-xl font-bold mb-4">Cập nhật thông tin</h3>
            {formError && <div className="mb-4 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">{formError}</div>}
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">
                  {editingUser.anh_dai_dien ? (
                    <img src={editingUser.anh_dai_dien} alt={editingUser.ho_ten} className="h-full w-full object-cover" />
                  ) : (
                    (editingUser.ho_ten || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-xs font-bold">Ảnh đại diện</label>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700">
                      <Icon name="image" className="h-3.5 w-3.5" />
                      {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={(e) => {
                          handleAvatarUpload(e.target.files?.[0], 'edit')
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {editingUser.anh_dai_dien && (
                      <button type="button" onClick={() => setEditingUser({ ...editingUser, anh_dai_dien: null })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white">
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div><label className="text-xs font-bold mb-1 block text-slate-400">Email (Không thể sửa)</label><input disabled className="input bg-slate-50" value={editingUser.email} /></div>
              <div><label className="text-xs font-bold mb-1 block">Họ tên *</label><input required className="input" value={editingUser.ho_ten} onChange={e => setEditingUser({ ...editingUser, ho_ten: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold mb-1 block">Điện thoại</label><input className="input" value={editingUser.so_dien_thoai || ''} onChange={e => setEditingUser({ ...editingUser, so_dien_thoai: e.target.value })} /></div>
                <div><label className="text-xs font-bold mb-1 block">Vai trò</label><select className="input" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}><option value="user">Bệnh nhân</option><option value="doctor">Bác sĩ</option><option value="admin">Admin</option></select></div>
              </div>
              <div><label className="text-xs font-bold mb-1 block">Trạng thái</label><select className="input" value={editingUser.status} onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}><option value="active">Hoạt động</option><option value="locked">Đang khóa</option></select></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button disabled={submitting} type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">Hủy</button>
              <button disabled={submitting} type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Cập nhật'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Hộp thoại xác nhận */}
      {confirmAction && createPortal(
        <ConfirmDialog
          open={!!confirmAction}
          danger={
            confirmAction?.type === 'delete' ||
            confirmAction?.type === 'hard-delete' ||
            confirmAction?.type === 'hard-delete-locked' ||
            (confirmAction?.type === 'lock' && confirmAction.user.status === 'active')
          }
          title={
            confirmAction?.type === 'hard-delete' || confirmAction?.type === 'hard-delete-locked'
              ? 'XÓA VĨNH VIỄN'
              : confirmAction?.type === 'delete'
              ? 'Xóa người dùng'
              : confirmAction?.type === 'restore'
              ? 'Khôi phục'
              : confirmAction?.user.status === 'active'
              ? 'Khóa tài khoản'
              : 'Mở khóa tài khoản'
          }
          message={
            confirmAction
              ? `Bạn có chắc muốn ${
                  confirmAction.type === 'hard-delete' || confirmAction.type === 'hard-delete-locked'
                    ? 'XÓA VĨNH VIỄN (không thể khôi phục)'
                    : confirmAction.type === 'delete'
                    ? 'xóa'
                    : confirmAction.type === 'restore'
                    ? 'khôi phục'
                    : confirmAction.user.status === 'active'
                    ? 'khóa'
                    : 'mở khóa'
                } người dùng "${confirmAction.user.ho_ten}"?${
                  confirmAction.type === 'hard-delete-locked'
                    ? ' Tài khoản này đang bị khóa và sẽ bị xóa hoàn toàn khỏi hệ thống.'
                    : ''
                }`
              : ''
          }
          confirmText="Xác nhận"
          onConfirm={onConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />,
        document.body
      )}

    </AdminAutoStagger>
  )
}
