import { useEffect, useState } from 'react'
import { paymentService } from '@/services/payment.service'
import type { PaymentItem, TransactionStatus } from '@/types'
import { PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '@/utils/constants'
import { formatPrice, formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

const STATUS_COLOR: Record<TransactionStatus, 'green' | 'yellow' | 'gray'> = {
  pending: 'yellow',
  paid: 'green',
  failed: 'gray',
  refunded: 'gray',
}

export default function ManagePayments() {
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<TransactionStatus | ''>('')
  const [confirm, setConfirm] = useState<PaymentItem | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    paymentService.getAll({ keyword, status }).then((data) => {
      if (!ignore) setPayments(data)
    }).finally(() => {
      if (!ignore) setLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [keyword, status])

  const revenue = {
    total: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.so_tien, 0),
    pending: payments.filter((payment) => payment.status === 'pending').length,
    refunded: payments.filter((payment) => payment.status === 'refunded').reduce((sum, payment) => sum + payment.so_tien, 0),
  }

  async function handleRefund() {
    if (!confirm) return
    const id = confirm.id
    setConfirm(null)
    const updated = await paymentService.refund(id)
    setPayments((prev) => prev.map((payment) => (payment.id === updated.id ? updated : payment)))
  }

  return (
    <div>
      <PageHeader
        title="Quan ly thanh toan"
        description="Theo doi giao dich, xac nhan thanh toan va xu ly yeu cau hoan tien."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Doanh thu (hien thi)</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800">{formatPrice(revenue.total)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <Icon name="trending" className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-green-600">tu cac giao dich thanh cong</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Cho thanh toan</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-800">{revenue.pending}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100">
              <Icon name="clock" className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">giao dich can xu ly</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Da hoan tra</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800">{formatPrice(revenue.refunded)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <Icon name="payment" className="h-6 w-6 text-slate-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">tong tien hoan tra</p>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input pl-9"
              placeholder="Tim ten, ma giao dich, bac si..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus | '')}>
            <option value="">Tat ca trang thai</option>
            <option value="paid">Da thanh toan</option>
            <option value="pending">Cho thanh toan</option>
            <option value="failed">That bai</option>
            <option value="refunded">Da hoan tien</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ma GD</th>
                <th className="px-4 py-3 font-medium">Benh nhan</th>
                <th className="px-4 py-3 font-medium">Bac si</th>
                <th className="px-4 py-3 font-medium">Ngay</th>
                <th className="px-4 py-3 font-medium">So tien</th>
                <th className="px-4 py-3 font-medium">Phuong thuc</th>
                <th className="px-4 py-3 font-medium">Trang thai</th>
                <th className="px-4 py-3 text-right font-medium">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Dang tai...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Khong tim thay giao dich.</td></tr>
              ) : payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{payment.ma_giao_dich}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{payment.benh_nhan}</td>
                  <td className="px-4 py-3 text-slate-600">{payment.bac_si}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(payment.ngay_tao)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatPrice(payment.so_tien)}</td>
                  <td className="px-4 py-3 text-slate-600">{PAYMENT_METHOD_LABEL[payment.phuong_thuc]}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[payment.status]}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.status === 'paid' && (
                      <button
                        onClick={() => setConfirm(payment)}
                        className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100"
                      >
                        <Icon name="payment" className="h-3 w-3" /> Hoan tien
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
        <p className="mt-3 text-sm text-slate-500">Tong cong {payments.length} giao dich</p>
      )}

      <ConfirmDialog
        open={!!confirm}
        danger
        title="Xac nhan hoan tien"
        message={`Hoan ${formatPrice(confirm?.so_tien ?? 0)} cho "${confirm?.benh_nhan}"? Thao tac nay khong the hoan tac.`}
        confirmText="Xac nhan hoan tien"
        onConfirm={handleRefund}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
