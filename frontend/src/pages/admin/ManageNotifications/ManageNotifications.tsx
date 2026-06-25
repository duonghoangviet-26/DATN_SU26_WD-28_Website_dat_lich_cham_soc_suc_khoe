import { useEffect, useState } from 'react'
import { notificationService } from '@/services/notification.service'
import type { NotificationItemAPI, NotificationTargetAPI } from '@/types'
import { formatDateTime } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import UpdateNotification from './UpdateNotification'

const TARGET_COLOR: Record<NotificationTargetAPI, 'gray' | 'blue' | 'green'> = {
  tat_ca: 'gray', benh_nhan: 'blue', bac_si: 'green',
}

const TARGET_LABEL: Record<NotificationTargetAPI, string> = {
  tat_ca: 'Tất cả',
  benh_nhan: 'Bệnh nhân',
  bac_si: 'Bác sĩ'
}

// Giả lập admin_id cho đến khi có auth thực sự
const CURRENT_ADMIN_ID = "000000000000000000000099"

export default function ManageNotifications() {
  const [notifications, setNotifications] = useState<NotificationItemAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  // Phân trang
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  // Form State
  const [tieu_de, setTieuDe] = useState('')
  const [noi_dung, setNoiDung] = useState('')
  const [doi_tuong, setDoiTuong] = useState<NotificationTargetAPI>('tat_ca')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)

  const [detail, setDetail] = useState<NotificationItemAPI | null>(null)
  const [targetEdit, setTargetEdit] = useState<NotificationItemAPI | null>(null)

  const loadData = async (ignore = false) => {
    setLoading(true)
    try {
      const { data, pagination } = await notificationService.getAll(page, 10)
      if (!ignore) {
        setNotifications(data)
        setTotalPages(pagination.totalPages)
        setTotalRecords(pagination.total)
      }
    } catch (err) {
      console.error('Lỗi tải danh sách thông báo:', err)
    } finally {
      if (!ignore) setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    loadData(ignore)
    return () => { ignore = true }
  }, [page])

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSendError('')
    setSendSuccess(false)
    if (!tieu_de.trim() || !noi_dung.trim()) {
      setSendError('Vui lòng điền đầy đủ tiêu đề và nội dung.')
      return
    }
    setSending(true)
    try {
      await notificationService.send({ 
        tieu_de, 
        noi_dung, 
        doi_tuong,
        admin_id: CURRENT_ADMIN_ID 
      })
      
      setTieuDe('')
      setNoiDung('')
      setDoiTuong('tat_ca')
      setSendSuccess(true)
      
      // Reload danh sách từ đầu
      if (page === 1) {
        loadData()
      } else {
        setPage(1)
      }

      setTimeout(() => setSendSuccess(false), 3000)
    } catch (err: any) {
      setSendError(err?.response?.data?.message || 'Gửi thất bại, vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Thông báo hệ thống"
        description="Gửi thông báo đến người dùng và xem lịch sử các thông báo đã gửi."
      />

      {/* Form gửi thông báo mới */}
      <div className="card mb-6 p-5 shadow-sm rounded-xl border border-slate-100">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 border border-brand-100">
            <Icon name="send" className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Gửi thông báo mới</h2>
            <p className="text-sm text-slate-500">Thông báo sẽ được gửi và lưu trữ lại trong lịch sử hệ thống</p>
          </div>
        </div>

        {sendError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
            <Icon name="alert-triangle" className="w-4 h-4 shrink-0" />
            <p>{sendError}</p>
          </div>
        )}
        {sendSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 p-3 text-sm text-green-700">
            <Icon name="check" className="w-4 h-4 shrink-0" />
            <p>Gửi thông báo thành công!</p>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tiêu đề thông báo</label>
              <input
                className="input bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder="Nhập tiêu đề ngắn gọn..."
                value={tieu_de}
                onChange={(e) => setTieuDe(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Đối tượng nhận</label>
              <select 
                className="input bg-slate-50 border-slate-200 focus:bg-white transition-colors" 
                value={doi_tuong} 
                onChange={(e) => setDoiTuong(e.target.value as NotificationTargetAPI)}
              >
                <option value="tat_ca">Tất cả (Bệnh nhân & Bác sĩ)</option>
                <option value="benh_nhan">Chỉ Bệnh nhân</option>
                <option value="bac_si">Chỉ Bác sĩ</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nội dung chi tiết</label>
            <textarea
              className="input resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              rows={4}
              placeholder="Nhập nội dung đầy đủ của thông báo..."
              value={noi_dung}
              onChange={(e) => setNoiDung(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" className="btn-primary py-2.5 px-6" disabled={sending}>
              <Icon name="send" className="h-4 w-4 mr-2" />
              {sending ? 'Hệ thống đang xử lý...' : 'Xác nhận gửi thông báo'}
            </button>
          </div>
        </form>
      </div>

      {/* Lịch sử thông báo */}
      <h2 className="mb-4 text-lg font-bold text-slate-800">Lịch sử đã gửi</h2>
      <div className="card overflow-hidden shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Tiêu đề</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Đối tượng</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Số người nhận</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Người tạo</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Thời gian gửi</th>
                <th className="px-5 py-3.5 text-right font-medium whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Đang tải dữ liệu lịch sử...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Chưa có thông báo nào trong hệ thống.</td></tr>
              ) : notifications.map((n) => (
                <tr key={n._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">{n.tieu_de}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{n.noi_dung}</p>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <Badge color={TARGET_COLOR[n.doi_tuong]}>
                      {TARGET_LABEL[n.doi_tuong]}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
                      <Icon name="users" className="w-3.5 h-3.5 text-slate-400" />
                      {n.so_nguoi_nhan.toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                    {n.tao_boi?.ho_ten || 'Hệ thống'}
                  </td>
                  <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                    {formatDateTime(n.ngay_gui)}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setDetail(n)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600 hover:border-brand-200"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" /> Chi tiết
                      </button>
                      <button
                        onClick={() => setTargetEdit(n)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" /> Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
      {!loading && totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between px-2">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-800">{notifications.length}</span> / <span className="font-semibold text-slate-800">{totalRecords}</span> thông báo
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Trang trước
            </button>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* Modal chi tiết thông báo */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden transform transition-all">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Nội dung thông báo</h3>
              <button onClick={() => setDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <h4 className="text-xl font-bold text-slate-800 mb-4">{detail.tieu_de}</h4>
              
              <div className="flex flex-wrap gap-3 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đối tượng:</span>
                  <Badge color={TARGET_COLOR[detail.doi_tuong]}>{TARGET_LABEL[detail.doi_tuong]}</Badge>
                </div>
                <div className="w-px h-4 bg-slate-300 self-center hidden sm:block"></div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon name="clock" className="w-4 h-4 text-slate-400" />
                  {formatDateTime(detail.ngay_gui)}
                </div>
                <div className="w-px h-4 bg-slate-300 self-center hidden sm:block"></div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon name="user" className="w-4 h-4 text-slate-400" />
                  {detail.tao_boi?.ho_ten || 'Hệ thống'}
                </div>
              </div>

              <div className="bg-white text-slate-700 text-sm leading-relaxed p-4 border border-slate-100 rounded-xl whitespace-pre-wrap min-h-[100px]">
                {detail.noi_dung}
              </div>
              
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Icon name="info" className="w-4 h-4 text-brand-500" />
                  Đã tiếp cận <strong className="text-slate-800">{detail.so_nguoi_nhan.toLocaleString('vi-VN')}</strong> tài khoản
                </p>
                <button onClick={() => setDetail(null)} className="btn-secondary px-6">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa thông báo */}
      {targetEdit && (
        <UpdateNotification 
          notification={targetEdit}
          onClose={() => setTargetEdit(null)}
          onSuccess={() => {
            setTargetEdit(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
