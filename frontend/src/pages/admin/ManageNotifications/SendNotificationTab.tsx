import { useEffect, useState } from 'react'
import { notificationService } from '@/services/notification.service'
import type { NotificationItemAPI, NotificationTargetAPI } from '@/types'
import { formatDateTime } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import UpdateNotification from './UpdateNotification'
import Pagination from '@/components/common/Pagination'

const TARGET_COLOR: Record<NotificationTargetAPI, 'gray' | 'blue' | 'green'> = {
  tat_ca: 'gray', benh_nhan: 'blue', bac_si: 'green',
}

const TARGET_LABEL: Record<NotificationTargetAPI, string> = {
  tat_ca: 'Tất cả',
  benh_nhan: 'Bệnh nhân',
  bac_si: 'Bác sĩ'
}

function getTargetColor(target: unknown): 'gray' | 'blue' | 'green' {
  return typeof target === 'string' && target in TARGET_COLOR
    ? TARGET_COLOR[target as NotificationTargetAPI]
    : 'gray'
}

function getTargetLabel(target: unknown) {
  return typeof target === 'string' && target in TARGET_LABEL
    ? TARGET_LABEL[target as NotificationTargetAPI]
    : 'Không xác định'
}

function formatRecipientCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('vi-VN')
    : '0'
}

export default function SendNotificationTab() {
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
  const [sendMethod, setSendMethod] = useState<'web' | 'email'>('web')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)

  const [detail, setDetail] = useState<NotificationItemAPI | null>(null)
  const [targetEdit, setTargetEdit] = useState<NotificationItemAPI | null>(null)
  const [targetLogs, setTargetLogs] = useState<NotificationItemAPI | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const loadData = async (ignore = false) => {
    setLoading(true)
    try {
      const { data, pagination } = await notificationService.getAll(page, 10)
      if (!ignore) {
        // Fix BUG 1: Out of bound page
        if (page > pagination.totalPages && pagination.totalPages > 0) {
          setPage(pagination.totalPages)
          return
        }
        setNotifications(data)
        setTotalPages(pagination.totalPages)
        setTotalRecords(pagination.total)
      }
    } catch {
    } finally {
      if (!ignore) setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    loadData(ignore)
    return () => { ignore = true }
  }, [page])

  useEffect(() => {
    if (targetLogs) {
      setLoadingLogs(true)
      notificationService.getLogs(targetLogs._id).then(data => {
        setLogs(data)
      }).catch(() => {
        setLogs([])
      }).finally(() => {
        setLoadingLogs(false)
      })
    } else {
      setLogs([])
    }
  }, [targetLogs])

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (doi_tuong === 'bac_si' && sendMethod === 'email') {
      alert('Giao diện Form Email đã sẵn sàng! Chờ kết nối Backend.')
      return
    }

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này? Dữ liệu không thể khôi phục.')) return
    try {
      await notificationService.delete(id)
      loadData()
      window.dispatchEvent(new Event('RELOAD_NOTIFICATIONS'))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi xóa')
    }
  }

  return (
    <div>
      {/* Form gửi thông báo mới */}
      <div className="card mb-6 p-5 shadow-sm rounded-xl border border-slate-100 mt-6">
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {doi_tuong === 'bac_si' && sendMethod === 'email' ? 'Tiêu đề Email (Subject)' : 'Tiêu đề thông báo'}
              </label>
              <input
                className="input bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder={doi_tuong === 'bac_si' && sendMethod === 'email' ? "Nhập tiêu đề Email..." : "Nhập tiêu đề ngắn gọn..."}
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

          {doi_tuong === 'bac_si' && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Hình thức gửi</label>
              <div className="flex gap-2 p-1 bg-slate-100/80 rounded-lg w-fit border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setSendMethod('web')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${sendMethod === 'web' ? 'bg-white text-brand-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon name="bell" className="w-4 h-4" /> Gửi qua Website (Mặc định)
                </button>
                <button
                  type="button"
                  onClick={() => setSendMethod('email')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${sendMethod === 'email' ? 'bg-white text-brand-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon name="mail" className="w-4 h-4" /> Gửi qua Email
                </button>
              </div>
            </div>
          )}

          {doi_tuong === 'bac_si' && sendMethod === 'email' && (
            <div className="flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <Icon name="alert-triangle" className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lưu ý: Tính năng kết nối máy chủ gửi Mail thực tế đang trong quá trình phát triển.</p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {doi_tuong === 'bac_si' && sendMethod === 'email' ? 'Nội dung Email (Body)' : 'Nội dung chi tiết'}
            </label>
            <textarea
              className="input resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              rows={4}
              placeholder={doi_tuong === 'bac_si' && sendMethod === 'email' ? "Nhập nội dung đầy đủ của Email..." : "Nhập nội dung đầy đủ của thông báo..."}
              value={noi_dung}
              onChange={(e) => setNoiDung(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" className="btn-primary py-2.5 px-6" disabled={sending}>
              {doi_tuong === 'bac_si' && sendMethod === 'email' ? (
                <>
                  <Icon name="mail" className="h-4 w-4 mr-2" />
                  Gửi Email
                </>
              ) : (
                <>
                  <Icon name="send" className="h-4 w-4 mr-2" />
                  {sending ? 'Hệ thống đang xử lý...' : 'Xác nhận gửi thông báo'}
                </>
              )}
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
                    <Badge color={getTargetColor(n.doi_tuong)}>
                      {getTargetLabel(n.doi_tuong)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
                      <Icon name="users" className="w-3.5 h-3.5 text-slate-400" />
                      {formatRecipientCount(n.so_nguoi_nhan)}
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
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                        title="Chi tiết"
                      >
                        <Icon name="eye" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTargetEdit(n)}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                        title="Sửa"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTargetLogs(n)}
                        className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 p-1.5 text-orange-600 transition-colors hover:bg-orange-100"
                        title="Lịch sử sửa đổi"
                      >
                        <Icon name="clock" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(n._id)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100"
                        title="Xóa thông báo"
                      >
                        <Icon name="trash-2" className="h-4 w-4" />
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
      {!loading && notifications.length > 0 && totalRecords > 0 && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-800">{(page - 1) * 10 + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(page * 10, totalRecords)}</span> trong tổng số <span className="font-semibold text-slate-800">{totalRecords}</span> thông báo
          </p>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
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
                  <Badge color={getTargetColor(detail.doi_tuong)}>{getTargetLabel(detail.doi_tuong)}</Badge>
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
                  Đã tiếp cận <strong className="text-slate-800">{formatRecipientCount(detail.so_nguoi_nhan)}</strong> tài khoản
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
            window.dispatchEvent(new Event('RELOAD_NOTIFICATIONS'))
          }}
        />
      )}

      {/* Modal Lịch sử sửa đổi */}
      {targetLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Lịch sử chỉnh sửa</h3>
              <button onClick={() => setTargetLogs(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {loadingLogs ? (
                <div className="flex justify-center p-8"><span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></span></div>
              ) : logs.length === 0 ? (
                <div className="text-center p-8 text-slate-400">
                  <Icon name="clock" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Chưa có lịch sử chỉnh sửa nào.</p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {logs.map((log) => (
                    <div key={log._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                        <Icon name="edit" className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">{log.nguoi_thuc_hien_id?.ho_ten || 'Admin'}</span>
                          <span className="text-xs font-medium text-slate-500">{formatDateTime(log.ngay_tao)}</span>
                        </div>
                        <div className="text-sm text-slate-600 mt-2 space-y-2">
                          {log.du_lieu_cu?.tieu_de !== log.du_lieu_moi?.tieu_de && (
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">Tiêu đề:</p>
                              <p className="line-through text-red-500/70 text-xs mb-1">{log.du_lieu_cu?.tieu_de}</p>
                              <p className="text-green-600 font-medium">{log.du_lieu_moi?.tieu_de}</p>
                            </div>
                          )}
                          {log.du_lieu_cu?.noi_dung !== log.du_lieu_moi?.noi_dung && (
                            <div className="pt-2 border-t border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">Nội dung:</p>
                              <p className="line-through text-red-500/70 text-xs mb-1 line-clamp-2">{log.du_lieu_cu?.noi_dung}</p>
                              <p className="text-green-600 font-medium line-clamp-2">{log.du_lieu_moi?.noi_dung}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end shrink-0">
              <button type="button" onClick={() => setTargetLogs(null)} className="px-5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
