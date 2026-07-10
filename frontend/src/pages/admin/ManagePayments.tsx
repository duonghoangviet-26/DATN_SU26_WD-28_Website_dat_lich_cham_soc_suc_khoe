import { useEffect, useMemo, useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import PageHeader from '@/components/common/PageHeader'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import { paymentService } from '@/services/payment.service'
import type { PaymentItem, TransactionStatus } from '@/types'
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatDateTime, formatPrice } from '@/utils/format'

const STATUS_COLOR: Record<TransactionStatus, 'green' | 'yellow' | 'gray'> = {
  pending: 'yellow',
  paid: 'green',
  failed: 'gray',
  refunded: 'gray',
}

interface ActionIconButtonProps {
  label: string
  icon: string
  title: string
  className: string
  onClick: () => void
}

interface PaymentDetailModalProps {
  detail: PaymentItem | null
  loading: boolean
  onClose: () => void
}

function ActionIconButton({ label, icon, title, className, onClick }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1 ${className}`}
    >
      <Icon name={icon} className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}

function PaymentDetailModal({ detail, loading, onClose }: PaymentDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Chi tiết giao dịch</h3>
              <p className="mt-1 text-sm text-slate-500">
                Rà soát đầy đủ thông tin thanh toán, hóa đơn và mốc thời gian xử lý.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">Đang tải chi tiết giao dịch...</div>
          ) : detail ? (
            <>
              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mã giao dịch</p>
                    <p className="mt-1 font-mono text-base font-semibold text-slate-900">{detail.ma_giao_dich || 'Chưa có mã'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Hóa đơn: <span className="font-medium text-slate-700">{detail.so_hoa_don || 'Chưa liên kết'}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge color={STATUS_COLOR[detail.status]}>{PAYMENT_STATUS_LABEL[detail.status]}</Badge>
                    <Badge color="blue">{PAYMENT_METHOD_LABEL[detail.phuong_thuc] || detail.phuong_thuc}</Badge>
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="Bệnh nhân" value={detail.benh_nhan || 'Không rõ'} />
                  <DetailField label="Email" value={detail.email || 'Không có'} />
                  <DetailField label="Số điện thoại" value={detail.so_dien_thoai || 'Không có'} />
                  <DetailField label="Bác sĩ" value={detail.bac_si || 'Không rõ'} />
                  <DetailField label="Số tiền" value={formatPrice(detail.so_tien)} />
                  <DetailField label="Loại thanh toán" value={detail.loai_thanh_toan || 'Chưa có dữ liệu'} />
                  <DetailField label="Thời điểm tạo" value={formatDateTime(detail.ngay_tao)} />
                  <DetailField label="Thời điểm thanh toán" value={formatDateTime(detail.thoi_diem_thanh_toan || detail.ngay_thanh_toan)} />
                  <DetailField label="Mã lịch hẹn" value={detail.appointment_id ? String(detail.appointment_id) : 'Chưa liên kết'} />
                  <DetailField label="Mã hóa đơn" value={detail.hoa_don_id ? String(detail.hoa_don_id) : 'Chưa liên kết'} />
                  <DetailField label="Số hóa đơn" value={detail.so_hoa_don || 'Chưa có'} />
                  <DetailField label="Trạng thái hóa đơn" value={detail.trang_thai_hoa_don || 'Chưa có'} />
                </dl>
              </div>

              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <button type="button" onClick={onClose} className="btn-secondary w-full">
                  Đóng
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="px-6 py-16 text-center text-sm text-slate-400">Không tải được chi tiết giao dịch.</div>
              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <button type="button" onClick={onClose} className="btn-secondary w-full">
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ManagePayments() {
  const itemsPerPage = 8
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<TransactionStatus | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<PaymentItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<PaymentItem | null>(null)

  useEffect(() => {
    let ignore = false

    async function fetchPayments() {
      setLoading(true)
      setError('')

      try {
        const data = await paymentService.getAll({
          keyword,
          status,
          from: fromDate || undefined,
          to: toDate || undefined,
        })

        if (!ignore) {
          setPayments(data)
        }
      } catch (nextError: any) {
        if (!ignore) {
          setPayments([])
          setError(nextError?.response?.data?.message || nextError?.message || 'Không tải được danh sách giao dịch.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetchPayments()

    return () => {
      ignore = true
    }
  }, [keyword, status, fromDate, toDate])

  useEffect(() => {
    setPage(1)
  }, [keyword, status, fromDate, toDate])

  const summary = useMemo(() => ({
    paidAmount: payments
      .filter((payment) => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.so_tien, 0),
    pendingCount: payments.filter((payment) => payment.status === 'pending').length,
    refundedAmount: payments
      .filter((payment) => payment.status === 'refunded')
      .reduce((sum, payment) => sum + payment.so_tien, 0),
  }), [payments])

  const totalPages = Math.max(1, Math.ceil(payments.length / itemsPerPage))
  const visiblePayments = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * itemsPerPage
    return payments.slice(startIndex, startIndex + itemsPerPage)
  }, [page, payments, totalPages])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  async function handleRefund() {
    if (!confirm) return

    const id = confirm.id
    setConfirm(null)

    try {
      const updated = await paymentService.refund(id)
      setPayments((prev) => prev.map((payment) => (payment.id === updated.id ? updated : payment)))
      if (detail?.id === updated.id) {
        const refreshed = await paymentService.getById(updated.id)
        setDetail(refreshed)
      }
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError?.message || 'Không thể hoàn tiền giao dịch.')
    }
  }

  async function handleOpenDetail(payment: PaymentItem) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)

    try {
      const nextDetail = await paymentService.getById(payment.id)
      setDetail(nextDetail)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError?.message || 'Không tải được chi tiết giao dịch.')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Quản lý thanh toán"
        description="Theo dõi đầy đủ giao dịch, mốc thời gian thanh toán và xử lý hoàn tiền từ dữ liệu thật của hệ thống."
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Đã thanh toán</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{formatPrice(summary.paidAmount)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <Icon name="trending" className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Tổng doanh thu từ các giao dịch trạng thái đã thanh toán.</p>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Chờ thanh toán</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{summary.pendingCount}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100">
              <Icon name="clock" className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Các giao dịch đang pending và cần tiếp tục đối soát.</p>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">Đã hoàn tiền</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{formatPrice(summary.refundedAmount)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <Icon name="rotate-ccw" className="h-6 w-6 text-slate-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Tổng số tiền đã được admin xử lý hoàn trả.</p>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input w-full pl-9"
              placeholder="Tìm mã giao dịch..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          <select
            className="input w-full"
            value={status}
            onChange={(event) => setStatus(event.target.value as TransactionStatus | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="failed">Thất bại</option>
            <option value="refunded">Đã hoàn tiền</option>
          </select>

          <input
            type="date"
            className="input w-full"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            title="Từ ngày"
          />

          <input
            type="date"
            className="input w-full"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            title="Đến ngày"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Giao dịch</th>
                <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                <th className="px-4 py-3 font-medium">Bác sĩ</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Số tiền</th>
                <th className="px-4 py-3 font-medium">Thanh toán</th>
                <th className="w-[112px] px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy giao dịch.
                  </td>
                </tr>
              ) : visiblePayments.map((payment) => (
                <tr key={payment.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-700">{payment.ma_giao_dich || 'Chưa có mã'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Hóa đơn: <span className="font-medium text-slate-700">{payment.so_hoa_don || 'Chưa liên kết'}</span>
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{payment.benh_nhan || 'Không rõ'}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.so_dien_thoai || 'Chưa có số điện thoại'}</p>
                    <p className="text-xs text-slate-400">{payment.email || 'Chưa có email'}</p>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <p>{payment.bac_si || 'Không rõ'}</p>
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tạo lúc</p>
                        <p className="mt-1 font-medium text-slate-700">{formatDateTime(payment.ngay_tao)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Thanh toán lúc</p>
                        <p className="mt-1 font-medium text-slate-700">
                          {formatDateTime(payment.thoi_diem_thanh_toan || payment.ngay_thanh_toan)}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{formatPrice(payment.so_tien)}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.loai_thanh_toan || 'Chưa phân loại'}</p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <Badge color="blue">{PAYMENT_METHOD_LABEL[payment.phuong_thuc] || payment.phuong_thuc}</Badge>
                      <div>
                        <Badge color={STATUS_COLOR[payment.status]}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                      </div>
                    </div>
                  </td>

                  <td className="w-[112px] px-4 py-3">
                    <div className="ml-auto flex w-[96px] flex-wrap justify-end gap-2">
                      <ActionIconButton
                        label="Xem chi tiết"
                        title="Xem chi tiết"
                        icon="eye"
                        onClick={() => handleOpenDetail(payment)}
                        className="border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-200"
                      />
                      {payment.status === 'paid' && (
                        <ActionIconButton
                          label="Hoàn tiền"
                          title="Hoàn tiền"
                          icon="rotate-ccw"
                          onClick={() => setConfirm(payment)}
                          className="border-orange-200 bg-orange-50 text-orange-600 hover:border-orange-300 hover:bg-orange-100 focus:ring-orange-200"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && payments.length > 0 && (
          <TablePaginationFooter
            currentPage={page}
            totalPages={totalPages}
            totalItems={payments.length}
            currentItemCount={visiblePayments.length}
            itemLabel="giao dịch"
            pageSize={itemsPerPage}
            onPageChange={setPage}
          />
        )}
      </div>

      {detailOpen && (
        <PaymentDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setDetailOpen(false)
            setDetailLoading(false)
            setDetail(null)
          }}
        />
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
