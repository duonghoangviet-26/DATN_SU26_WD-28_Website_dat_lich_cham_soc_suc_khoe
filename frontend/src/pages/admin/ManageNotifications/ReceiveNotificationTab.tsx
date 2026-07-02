import { useEffect, useState } from 'react'
import { notificationService } from '@/services/notification.service'
import { formatDateTime } from '@/utils/format'
import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'

export default function ReceiveNotificationTab() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Phân trang
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  const [detail, setDetail] = useState<any | null>(null)

  const loadData = async (ignore = false) => {
    setLoading(true)
    try {
      const { data, pagination } = await notificationService.getReceived(page, 10)
      if (!ignore) {
        setNotifications(data)
        setTotalPages(pagination.totalPages)
        setTotalRecords(pagination.total)
      }
    } catch (err) {
      console.error('Lỗi tải danh sách thông báo nhận:', err)
    } finally {
      if (!ignore) setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    loadData(ignore)
    return () => { ignore = true }
  }, [page])

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <div>
      <div className="card overflow-hidden shadow-sm border border-slate-100 mt-6">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
              <Icon name="inbox" className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Hộp thư đến</h2>
              <p className="text-sm text-slate-500">Các thông báo từ hệ thống và người dùng gửi đến Admin</p>
            </div>
          </div>
          <button onClick={() => loadData()} className="btn-secondary px-3 py-2 text-sm">
            <Icon name="refresh-cw" className="w-4 h-4 mr-2" /> Làm mới
          </button>
        </div>

        <div className="overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap w-2/3">Nội dung</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap">Thời gian nhận</th>
                <th className="px-5 py-3.5 font-medium whitespace-nowrap text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right font-medium whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Đang tải hộp thư...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Hộp thư đến của bạn đang trống.</td></tr>
              ) : notifications.map((n) => (
                <tr key={n._id} className={`hover:bg-slate-50 transition-colors ${!n.da_doc ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Icon name="bell" className={`w-4 h-4 ${!n.da_doc ? 'text-blue-500' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className={`text-slate-800 ${!n.da_doc ? 'font-bold' : 'font-semibold'}`}>{n.tieu_de}</p>
                        <p className={`text-xs mt-1 truncate max-w-lg ${!n.da_doc ? 'text-slate-700' : 'text-slate-500'}`}>
                          {n.noi_dung}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                    {formatDateTime(n.ngay_tao)}
                  </td>
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    {n.da_doc ? (
                      <Badge color="gray">Đã đọc</Badge>
                    ) : (
                      <Badge color="blue">Chưa đọc</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => setDetail(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600 hover:border-brand-200"
                    >
                      <Icon name="eye" className="h-3.5 w-3.5" /> Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
      {!loading && totalRecords > 0 && (
        <div className="mt-5 flex items-center justify-between px-2">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-800">{(page - 1) * 10 + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(page * 10, totalRecords)}</span> trong tổng số <span className="font-semibold text-slate-800">{totalRecords}</span> thông báo
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button 
                disabled={page === 1} 
                onClick={() => handlePageChange(page - 1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Trang trước
              </button>
              <button 
                disabled={page === totalPages} 
                onClick={() => handlePageChange(page + 1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Trang sau
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal chi tiết thông báo */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden transform transition-all">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết thông báo</h3>
              <button onClick={() => setDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <h4 className="text-xl font-bold text-slate-800 mb-4">{detail.tieu_de}</h4>
              
              <div className="flex flex-wrap gap-3 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon name="clock" className="w-4 h-4 text-slate-400" />
                  {formatDateTime(detail.ngay_tao)}
                </div>
              </div>

              <div className="bg-white text-slate-700 text-sm leading-relaxed p-4 border border-slate-100 rounded-xl whitespace-pre-wrap min-h-[100px]">
                {detail.noi_dung}
              </div>
              
              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setDetail(null)} className="btn-secondary px-6">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
