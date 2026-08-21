import { useEffect, useState } from 'react'
import { FileText, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Phone, Mail, MessageCircle } from 'lucide-react'

import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import { dashboardService } from '@/services/dashboard.service'
import type { InvoicedDetails, DebtItem } from '@/types'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'debt-list'>('overview')
  const [data, setData] = useState<InvoicedDetails | null>(null)
  const [debtList, setDebtList] = useState<DebtItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDebt, setLoadingDebt] = useState(false)
  const [error, setError] = useState('')
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  useEffect(() => {
    if (!isOpen || activeTab !== 'debt-list') return
    if (debtList.length > 0) return
    const controller = new AbortController()

    async function loadDebtList() {
      setLoadingDebt(true)
      try {
        const list = await dashboardService.getDebtList(controller.signal)
        if (!controller.signal.aborted) {
          setDebtList(list)
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err?.code !== 'ERR_CANCELED') {
          setToastMsg({ message: 'Không tải được danh sách công nợ', type: 'error' })
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDebt(false)
        }
      }
    }

    loadDebtList()
    return () => controller.abort()
  }, [isOpen, activeTab, debtList.length])

  const handleRemindDebt = async (item: DebtItem) => {
    try {
      setRemindingId(item._id)
      const res = await dashboardService.remindDebt(item)
      setToastMsg({ message: res.message || 'Đã gửi email nhắc nợ thành công', type: 'success' })
    } catch (err: any) {
      setToastMsg({ message: err?.response?.data?.message || err.message || 'Lỗi khi gửi email nhắc nợ', type: 'error' })
    } finally {
      setRemindingId(null)
    }
  }

  return (
    <>
      {toastMsg && (
        <Toast
          message={toastMsg.message}
          type={toastMsg.type}
          onClose={() => setToastMsg(null)}
        />
      )}
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
          <div className="flex space-x-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setActiveTab('debt-list')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                activeTab === 'debt-list' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Danh sách Công nợ
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="truncate text-sm font-medium text-slate-500">Tháng này</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                    <p className="truncate text-lg font-bold tracking-tight text-slate-800 sm:text-xl">{formatCurrency(data.invoicedThisMonth)}</p>
                    <div className={`flex items-center whitespace-nowrap text-xs font-semibold ${data.growth === null ? 'text-slate-400' : (data.growth >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                      {data.growth === null ? (
                        '-'
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
          )}

          {activeTab === 'debt-list' && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <h3 className="font-semibold text-slate-800">Khách hàng chưa thanh toán đủ</h3>
              </div>
              <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
                {loadingDebt ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-orange-600" />
                  </div>
                ) : debtList.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Không có khách hàng nào đang nợ.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-medium">Khách hàng</th>
                        <th className="px-4 py-3 font-medium">Hóa đơn</th>
                        <th className="px-4 py-3 font-medium">Dịch vụ</th>
                        <th className="px-4 py-3 text-right font-medium">Còn nợ</th>
                        <th className="px-4 py-3 text-center font-medium">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {debtList.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-slate-900">{item.ho_ten}</div>
                            <div className="text-slate-500">{item.so_dien_thoai}</div>
                            {item.email && <div className="text-xs text-slate-400">{item.email}</div>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <div className="font-medium">{item.so_hoa_don}</div>
                            <div className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('vi-VN')}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <ul className="list-disc pl-4 text-xs text-slate-600">
                              {item.chi_tiet_thu_phi.map((sv, idx) => (
                                <li key={idx}>{sv.ten} (x{sv.so_luong})</li>
                              ))}
                            </ul>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                            <div className="font-bold text-red-600">{formatCurrency(item.no_hoa_don)}</div>
                            <div className="text-xs text-slate-500">Tổng: {formatCurrency(item.tong_thanh_toan)}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center justify-center gap-2">
                              {item.so_dien_thoai && (
                                <>
                                  <a
                                    href={`tel:${item.so_dien_thoai}`}
                                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                                    title="Gọi điện"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </a>
                                  <a
                                    href={`https://zalo.me/${item.so_dien_thoai.replace(/^0/, '84')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-500"
                                    title="Nhắn Zalo"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                </>
                              )}
                              {item.email && (
                                <button
                                  onClick={() => handleRemindDebt(item)}
                                  disabled={remindingId === item._id}
                                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-orange-600 disabled:opacity-50"
                                  title="Gửi email nhắc nợ"
                                >
                                  {remindingId === item._id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
    </>
  )
}
