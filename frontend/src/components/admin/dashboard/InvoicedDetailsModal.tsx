import { useEffect, useState } from 'react'
import { FileText, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react'

import Modal from '@/components/common/Modal'
import { dashboardService } from '@/services/dashboard.service'
import type { InvoicedDetails } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

interface InvoicedDetailsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InvoicedDetailsModal({ isOpen, onClose }: InvoicedDetailsModalProps) {
  const [data, setData] = useState<InvoicedDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const controller = new AbortController()

    async function loadData() {
      setLoading(true)
      setError('')
      try {
        const details = await dashboardService.getInvoicedDetails(controller.signal)
        if (!controller.signal.aborted) {
          setData(details)
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err?.code !== 'ERR_CANCELED') {
          setError(err?.response?.data?.message || err.message || 'Không tải được chi tiết doanh thu')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => controller.abort()
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết Doanh thu Xuất hóa đơn" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-orange-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6 pb-2">
          {/* Tổng quan */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="truncate text-sm font-medium text-slate-500">Tháng này</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                <p className="truncate text-lg font-bold tracking-tight text-slate-800 sm:text-xl">{formatCurrency(data.invoicedThisMonth)}</p>
                <div className={`flex items-center whitespace-nowrap text-xs font-semibold ${data.growth === null ? 'text-slate-400' : (data.growth >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                  {data.growth === null ? (
                    '—'
                  ) : (
                    <>
                      {data.growth >= 0 ? <TrendingUp className="mr-1 h-3 w-3 shrink-0" /> : <TrendingDown className="mr-1 h-3 w-3 shrink-0" />}
                      {data.growth}%
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="truncate text-sm font-medium text-slate-500">Tháng trước</p>
              <p className="mt-1 truncate text-lg font-bold tracking-tight text-slate-800 sm:text-xl">{formatCurrency(data.invoicedLastMonth)}</p>
            </div>
            
            <div className="min-w-0 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Tổng công nợ
              </p>
              <p className="mt-1 truncate text-lg font-bold tracking-tight text-red-700 sm:text-xl">{formatCurrency(data.outstandingTotal)}</p>
            </div>
            
            <div className="min-w-0 rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-orange-700">
                <FileText className="h-4 w-4 shrink-0" /> Tổng xuất hóa đơn
              </p>
              <p className="mt-1 truncate text-lg font-bold tracking-tight text-orange-900 sm:text-xl">{formatCurrency(data.invoicedTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Doanh thu theo tháng */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <h3 className="truncate font-semibold text-slate-800">Doanh thu 12 tháng (Năm {new Date().getFullYear()})</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Tháng</th>
                      <th className="px-4 py-3 text-right font-medium sm:px-5">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.thisYearMonthly.map((m) => (
                      <tr key={m.thang} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">Tháng {m.thang}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums sm:px-5">{formatCurrency(m.tongHoaDon)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Doanh thu theo năm */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <h3 className="truncate font-semibold text-slate-800">Doanh thu các năm</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Năm</th>
                      <th className="px-4 py-3 text-right font-medium sm:px-5">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.yearly.map((y) => (
                      <tr key={y.nam} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">{y.nam}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums sm:px-5">{formatCurrency(y.tongHoaDon)}</td>
                      </tr>
                    ))}
                    {data.yearly.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-500 sm:px-5">Chưa có dữ liệu</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
