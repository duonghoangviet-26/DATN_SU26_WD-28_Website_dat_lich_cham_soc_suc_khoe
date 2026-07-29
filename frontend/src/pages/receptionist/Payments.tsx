import { useEffect, useState } from 'react'
import { CheckCircle2, Search, Banknote, RefreshCw, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { receptionistPaymentService, type PaymentFilters } from '@/services/receptionist-payment.service'
import type { PaymentItem } from '@/types'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Toast from '@/components/common/Toast'
import Modal from '@/components/common/Modal'
import { format } from 'date-fns'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">Đã thanh toán</span>
    case 'pending':
      return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200">Chưa thanh toán</span>
    case 'refunded':
      return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">Đã hoàn tiền</span>
    case 'failed':
      return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200">Thất bại</span>
    default:
      return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{status}</span>
  }
}

const getMethodBadge = (method: string) => {
  if (method === 'tien_mat') {
    return <span className="flex items-center gap-1 text-slate-600 text-sm"><Banknote className="w-4 h-4 text-emerald-600" /> Tiền mặt</span>
  }
  return <span className="flex items-center gap-1 text-slate-600 text-sm"><RefreshCw className="w-4 h-4 text-blue-600" /> Chuyển khoản</span>
}

export default function ReceptionistPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<PaymentFilters>({
    keyword: '',
    status: '',
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
    page: 1,
    limit: 10
  })
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<PaymentItem | null>(null)
  const [confirming, setConfirming] = useState(false)

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res = await receptionistPaymentService.getAll(filters)
      setPayments(res.data)
    } catch (error: any) {
      setToast({ message: error.message || 'Lỗi khi tải danh sách thanh toán', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [filters.keyword, filters.status, filters.page])

  const handleConfirmCash = async () => {
    if (!confirmModal) return
    try {
      setConfirming(true)
      await receptionistPaymentService.confirmCashPayment(confirmModal.id)
      setToast({ message: 'Xác nhận thu tiền mặt thành công!', type: 'success' })
      setConfirmModal(null)
      fetchPayments()
    } catch (error: any) {
      setToast({ message: error.response?.data?.message || 'Có lỗi xảy ra khi xác nhận', type: 'error' })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Thu ngân & Thanh toán</h1>
          <p className="text-slate-500 mt-1">Quản lý các khoản thu viện phí và xác nhận tiền mặt</p>
        </div>
        <Button onClick={() => fetchPayments()} variant="secondary" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Làm mới
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên BN, mã GD..."
              value={filters.keyword}
              onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value, page: 1 }))}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Từ:</span>
            <input
              type="date"
              value={filters.from || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Đến:</span>
            <input
              type="date"
              value={filters.to || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-sm"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-sm min-w-[160px]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
          </select>
          
          {(filters.from !== format(new Date(), 'yyyy-MM-dd') || filters.to !== format(new Date(), 'yyyy-MM-dd') || filters.status !== '' || filters.keyword !== '') && (
            <Button 
              variant="secondary" 
              onClick={() => setFilters({ keyword: '', status: '', from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd'), page: 1, limit: 10 })}
              className="text-sm px-3"
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600 font-medium">
                <th className="px-6 py-4">Mã Giao Dịch</th>
                <th className="px-6 py-4">Bệnh Nhân</th>
                <th className="px-6 py-4">Số Tiền</th>
                <th className="px-6 py-4">Phương Thức</th>
                <th className="px-6 py-4">Trạng Thái</th>
                <th className="px-6 py-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    Không tìm thấy giao dịch nào.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-slate-900">{payment.ma_giao_dich}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {payment.ngay_tao ? format(new Date(payment.ngay_tao), 'dd/MM/yyyy HH:mm') : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {payment.benh_nhan === 'Không rõ' ? (
                        <div className="font-medium text-slate-400 italic">Không rõ (Lỗi dữ liệu)</div>
                      ) : (
                        <div className="font-medium text-slate-900">{payment.benh_nhan}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-emerald-600">{formatCurrency(payment.so_tien)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getMethodBadge(payment.phuong_thuc)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {payment.status === 'pending' && payment.phuong_thuc === 'tien_mat' ? (
                        <Button 
                          size="sm" 
                          onClick={() => setConfirmModal(payment)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Xác nhận thu
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-sm italic">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal isOpen={!!confirmModal} onClose={() => !confirming && setConfirmModal(null)} title="Xác nhận thu tiền mặt">
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex items-start gap-3 text-emerald-800">
            <Banknote className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Xác nhận thu đủ tiền từ bệnh nhân</p>
              <p className="text-sm mt-1 opacity-90">Vui lòng kiểm tra kỹ số tiền trước khi xác nhận. Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã giao dịch:</span>
              <span className="font-mono font-medium">{confirmModal?.ma_giao_dich}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bệnh nhân:</span>
              <span className="font-medium">{confirmModal?.benh_nhan}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Số tiền cần thu:</span>
              <span className="font-bold text-lg text-emerald-600">{confirmModal ? formatCurrency(confirmModal.so_tien) : '0 ₫'}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setConfirmModal(null)} disabled={confirming}>
              Hủy bỏ
            </Button>
            <Button onClick={handleConfirmCash} loading={confirming} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Xác nhận đã thu tiền
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
