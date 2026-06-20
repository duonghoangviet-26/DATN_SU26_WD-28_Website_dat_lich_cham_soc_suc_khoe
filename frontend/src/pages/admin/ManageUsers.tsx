import { useEffect, useState } from 'react'
import { userService } from '@/services/user.service'
import { useAuth } from '@/context/AuthContext'
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
  const [confirmAction, setConfirmAction] = useState<{ type: 'lock' | 'delete' | 'restore', user: User } | null>(null)

  // Form state
  const [formData, setFormData] = useState({ ho_ten: '', email: '', mat_khau: '', so_dien_thoai: '', role: 'user' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await userService.getAll({ keyword, role, status, page, limit: 10, isDeleted: isDeleted ? 'true' : 'false' } as any)
      setUsers(res.data)
      setPagination(res.pagination)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [keyword, role, status, page, isDeleted])

  // --- HANDLERS ---

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await userService.create(formData)
      setShowAddModal(false)
      setFormData({ ho_ten: '', email: '', mat_khau: '', so_dien_thoai: '', role: 'user' })
      loadUsers()
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi khi tạo')
    } finally { setSubmitting(false) }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setSubmitting(true)
    try {
      await userService.update(editingUser.id, editingUser)
      setEditingUser(null)
      loadUsers()
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
      }
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Thao tác thất bại')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quản lý người dùng" description="Quản lý tài khoản, vai trò và trạng thái thành viên.">
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
          <Icon name="plus" className="h-4 w-4" /> Thêm người dùng
        </button>
      </PageHeader>

      {/* Bộ lọc */}
      <div className="card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className="input pl-10" placeholder="Tìm tên hoặc email..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} />
          </div>
          <select className="input" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
            <option value="">Tất cả vai trò</option>
            {Object.entries(ROLES).map(([key, val]) => <option key={val} value={val}>{ROLE_LABEL[val]}</option>)}
          </select>
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            <option value={USER_STATUS.ACTIVE}>Hoạt động</option>
            <option value={USER_STATUS.LOCKED}>Đã khóa</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
           <input type="checkbox" id="trash" checked={isDeleted} onChange={e => { setIsDeleted(e.target.checked); setPage(1); }} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
           <label htmlFor="trash" className="cursor-pointer font-medium selection:bg-none">Xem tài khoản đã xóa (Thùng rác)</label>
        </div>
      </div>

      {/* Lỗi */}
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 border border-red-100">
        <Icon name="ban" className="h-5 w-5" /> {error}
      </div>}

      {/* Bảng */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Thành viên</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Vai trò</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">{isDeleted ? 'Ngày xóa' : 'Ngày tạo'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><div className="animate-pulse text-slate-400 font-medium">Đang tải dữ liệu...</div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium">Không tìm thấy người dùng phù hợp.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-lg">
                          {(u.ho_ten || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.ho_ten}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Badge color={u.role==='admin' ? 'yellow' : u.role==='doctor' ? 'blue' : 'gray'}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="px-4 py-4"><Badge color={u.status==='active' ? 'green' : 'red'}>{USER_STATUS_LABEL[u.status]}</Badge></td>
                    <td className="px-4 py-4 text-slate-500">{formatDate(isDeleted ? u.ngay_xoa : u.ngay_tao)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSelectedUser(u)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Xem"><Icon name="eye" className="h-4 w-4" /></button>
                        
                        {!isDeleted ? (
                          <>
                            <button onClick={() => setEditingUser(u)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Sửa"><Icon name="edit" className="h-4 w-4" /></button>
                            {u.id !== currentUser?.id && (
                              <>
                                <button onClick={() => setConfirmAction({type:'lock', user:u})} className={`p-2 rounded-lg transition-colors ${u.status==='active' ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-orange-600 bg-orange-50'}`} title={u.status==='active'?'Khóa':'Mở khóa'}><Icon name="ban" className="h-4 w-4" /></button>
                                <button onClick={() => setConfirmAction({type:'delete', user:u})} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Icon name="trash" className="h-4 w-4" /></button>
                              </>
                            )}
                          </>
                        ) : (
                          <button onClick={() => setConfirmAction({type:'restore', user:u})} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Khôi phục"><Icon name="check" className="h-4 w-4" /></button>
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
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Icon name="user" className="h-5 w-5" /> Thông tin chi tiết</h3>
            <div className="space-y-4">
              <div className="flex justify-center mb-4 text-center">
                <div className="h-20 w-20 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-3xl mb-2">{selectedUser.ho_ten?.charAt(0).toUpperCase()}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div><label className="text-xs text-slate-400 font-bold uppercase">Họ tên</label><p className="text-sm font-bold">{selectedUser.ho_ten}</p></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Email</label><p className="text-sm font-bold truncate">{selectedUser.email}</p></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Điện thoại</label><p className="text-sm font-bold">{selectedUser.so_dien_thoai || '—'}</p></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Vai trò</label><div><Badge color={selectedUser.role==='admin'?'yellow':selectedUser.role==='doctor'?'blue':'gray'}>{ROLE_LABEL[selectedUser.role]}</Badge></div></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Trạng thái</label><div><Badge color={selectedUser.status==='active'?'green':'red'}>{USER_STATUS_LABEL[selectedUser.status]}</Badge></div></div>
                <div><label className="text-xs text-slate-400 font-bold uppercase">Ngày tham gia</label><p className="text-sm font-bold">{formatDate(selectedUser.ngay_tao)}</p></div>
              </div>
            </div>
            <button onClick={() => setSelectedUser(null)} className="w-full mt-8 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">Đóng lại</button>
          </div>
        </div>
      )}

      {/* Modal Thêm */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleAddSubmit} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-xl font-bold mb-4">Thêm thành viên mới</h3>
            {formError && <div className="mb-4 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">{formError}</div>}
            <div className="space-y-3">
              <div><label className="text-xs font-bold mb-1 block">Họ tên *</label><input required className="input" value={formData.ho_ten} onChange={e => setFormData({...formData, ho_ten: e.target.value})} /></div>
              <div><label className="text-xs font-bold mb-1 block">Email *</label><input required type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              <div><label className="text-xs font-bold mb-1 block">Mật khẩu *</label><input required type="password" className="input" value={formData.mat_khau} onChange={e => setFormData({...formData, mat_khau: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold mb-1 block">Điện thoại</label><input className="input" value={formData.so_dien_thoai} onChange={e => setFormData({...formData, so_dien_thoai: e.target.value})} /></div>
                <div><label className="text-xs font-bold mb-1 block">Vai trò</label><select className="input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="user">Bệnh nhân</option><option value="doctor">Bác sĩ</option><option value="admin">Admin</option></select></div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button disabled={submitting} type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">Hủy</button>
              <button disabled={submitting} type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Lưu người dùng'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Sửa */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleEditSubmit} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-xl font-bold mb-4">Cập nhật thông tin</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-bold mb-1 block text-slate-400">Email (Không thể sửa)</label><input disabled className="input bg-slate-50" value={editingUser.email} /></div>
              <div><label className="text-xs font-bold mb-1 block">Họ tên *</label><input required className="input" value={editingUser.ho_ten} onChange={e => setEditingUser({...editingUser, ho_ten: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold mb-1 block">Điện thoại</label><input className="input" value={editingUser.so_dien_thoai || ''} onChange={e => setEditingUser({...editingUser, so_dien_thoai: e.target.value})} /></div>
                <div><label className="text-xs font-bold mb-1 block">Vai trò</label><select className="input" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}><option value="user">Bệnh nhân</option><option value="doctor">Bác sĩ</option><option value="admin">Admin</option></select></div>
              </div>
              <div><label className="text-xs font-bold mb-1 block">Trạng thái</label><select className="input" value={editingUser.status} onChange={e => setEditingUser({...editingUser, status: e.target.value as any})}><option value="active">Hoạt động</option><option value="locked">Đang khóa</option></select></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button disabled={submitting} type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">Hủy</button>
              <button disabled={submitting} type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Cập nhật'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Hộp thoại xác nhận */}
      <ConfirmDialog
        open={!!confirmAction}
        danger={confirmAction?.type === 'delete' || (confirmAction?.type === 'lock' && confirmAction.user.status === 'active')}
        title={confirmAction?.type === 'delete' ? 'Xóa người dùng' : confirmAction?.type === 'restore' ? 'Khôi phục' : confirmAction?.user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={confirmAction ? `Bạn có chắc muốn ${confirmAction.type==='delete'?'xóa':confirmAction.type==='restore'?'khôi phục':confirmAction.user.status==='active'?'khóa':'mở khóa'} người dùng "${confirmAction.user.ho_ten}"?` : ''}
        confirmText="Xác nhận"
        onConfirm={onConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
