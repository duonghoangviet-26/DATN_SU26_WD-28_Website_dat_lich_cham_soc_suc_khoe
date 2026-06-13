import { useEffect, useState } from 'react'
import { paymentService } from '@/services/payment.service'
import type { PaymentItem, PaymentStatus } from '@/types'
import { PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '@/utils/constants'
import { formatPrice, formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

const STATUS_COLOR: Record<PaymentStatus, 'green' | 'yellow' | 'gray'> = {
  paid: 'green', unpaid: 'yellow', refunded: 'gray',
}

export default function ManagePayments() {
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<PaymentStatus | ''>('')
  const [confirm, setConfirm] = useState<PaymentItem | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    paymentService.getAll({ keyword, status }).then((data) => {
      if (!ignore) setPayments(data)
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [keyword, status])

  const revenue = {
    total: payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.so_tien, 0),
    unpaid: payments.filter((p) => p.status === 'unpaid').length,
    refunded: payments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.so_tien, 0),
  }

  async function handleRefund() {
    if (!confirm) return
    const id = confirm.id
    setConfirm(null)
    const updated = await paymentService.refund(id)
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div>
      <PageHeader
        title="Quản lý thanh toán"
        description="Theo dõi giao dịch, xác nhận thanh toán và xử lý yêu cầu hoàn tiền."
      />

      {/* Thẻ thống kê tài chính */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Doanh thu (hiển thị)</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800">{formatPrice(revenue.total)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <Icon name="trending" className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-green-600">↑ từ các giao dịch thành công</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Chờ thanh toán</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-800">{revenue.unpaid}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100">
              <Icon name="clock" className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">giao dịch cần xử lý</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Đã hoàn trả</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800">{formatPrice(revenue.refunded)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <Icon name="payment" className="h-6 w-6 text-slate-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">tổng tiền hoàn trả</p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input pl-9"
              placeholder="Tìm tên, mã giao dịch, bác sĩ..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}>
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="refunded">Đã hoàn tiền</option>
          </select>
        </div>
      </div>

      {/* Bảng giao dịch */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Mã GD</th>
                <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                <th className="px-4 py-3 font-medium">Bác sĩ</th>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3 font-medium">Số tiền</th>
                <th className="px-4 py-3 font-medium">Phương thức</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Không tìm thấy giao dịch.</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.ma_giao_dich}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.benh_nhan}</td>
                  <td className="px-4 py-3 text-slate-600">{p.bac_si}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.ngay_tao)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatPrice(p.so_tien)}</td>
                  <td className="px-4 py-3 text-slate-600">{PAYMENT_METHOD_LABEL[p.phuong_thuc]}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'paid' && (
                      <button
                        onClick={() => setConfirm(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100"
                      >
                        <Icon name="payment" className="h-3 w-3" /> Hoàn tiền
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="mt-3 text-sm text-slate-500">Tổng cộng {payments.length} giao dịch</p>
      )}

      <ConfirmDialog
        open={!!confirm}
        danger
        title="Xác nhận hoàn tiền"
        message={`Hoàn ${formatPrice(confirm?.so_tien ?? 0)} cho "${confirm?.benh_nhan}"? Thao tác này không thể hoàn tác.`}
        confirmText="Xác nhận hoàn tiền"
        onConfirm={handleRefund}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
