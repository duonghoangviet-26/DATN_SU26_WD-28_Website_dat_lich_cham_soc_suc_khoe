import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { appointmentService } from '@/services/appointment.service'
import type {
  AppointmentItem,
  AppointmentPagination,
  AppointmentStatus,
  AppointmentSummary,
  PaymentStatus,
} from '@/types'

import AddAppointment from './AddAppointment'
import AppointmentDetail from './AppointmentDetail'
import AppointmentHistoryModal from './AppointmentHistoryModal'
import AppointmentList from './AppointmentList'
import RescheduleAppointment from './RescheduleAppointment'

type ViewMode = 'list' | 'add' | 'reschedule'
type QuickFilter = 'all' | 'today' | 'upcoming' | 'unpaid' | 'cancelled' | 'need_attention'

const EMPTY_SUMMARY: AppointmentSummary = {
  today: 0,
  pending: 0,
  confirmed: 0,
  completed: 0,
  in_progress: 0,
  cancelled: 0,
  unpaid: 0,
  need_attention: 0,
}

const EMPTY_PAGINATION: AppointmentPagination = {
  total: 0,
  totalPages: 1,
  page: 1,
}

export default function ManageAppointments() {
  const [view, setView] = useState<ViewMode>('list')
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const filterDoctorId = searchParams.get('doctor_id')
  const filterDoctorName = searchParams.get('doctor_name')

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('')
  const [loaiKham, setLoaiKham] = useState<'clinic' | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')

  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<AppointmentPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<AppointmentSummary>(EMPTY_SUMMARY)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<AppointmentItem | null>(null)
  const [rescheduleData, setRescheduleData] = useState<AppointmentItem | null>(null)
  const [historyItem, setHistoryItem] = useState<AppointmentItem | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedKeyword !== keyword) {
        setDebouncedKeyword(keyword)
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [keyword, debouncedKeyword])

  const fetchAppointments = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError(null)

    try {
      const res = await appointmentService.getAll({
        keyword: debouncedKeyword,
        status,
        payment_status: paymentStatus || undefined,
        loai_kham: loaiKham || undefined,
        startDate,
        endDate,
        page: nextPage,
        limit: 10,
        doctor_id: filterDoctorId || undefined,
        quick_filter: quickFilter === 'all' ? undefined : quickFilter,
      })

      setAppointments(Array.isArray(res.data) ? res.data : [])
      setSummary(res.summary ?? EMPTY_SUMMARY)
      setPagination(res.pagination ?? EMPTY_PAGINATION)
    } catch (nextError: any) {
      setAppointments([])
      setSummary(EMPTY_SUMMARY)
      setPagination(EMPTY_PAGINATION)
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể tải danh sách lịch hẹn.')
    } finally {
      setLoading(false)
    }
  }, [debouncedKeyword, status, paymentStatus, loaiKham, startDate, endDate, page, filterDoctorId, quickFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  async function handleCancel(appointment: AppointmentItem, reason: string) {
    try {
      await appointmentService.cancel(appointment._id, reason, appointment.ngay_cap_nhat)
      await fetchAppointments(page)
    } catch (nextError: any) {
      alert(nextError.response?.data?.message || nextError.message)
      await fetchAppointments(page)
    }
  }

  async function handleRestore(appointment: AppointmentItem) {
    try {
      await appointmentService.restore(appointment._id)
      await fetchAppointments(page)
    } catch (nextError: any) {
      alert(nextError.response?.data?.message || nextError.message)
    }
  }

  async function handleHardDelete(appointment: AppointmentItem) {
    try {
      await appointmentService.hardDelete(appointment._id)
      await fetchAppointments(page)
    } catch (nextError: any) {
      alert(nextError.response?.data?.message || nextError.message)
    }
  }

  async function handleView(appointment: AppointmentItem) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)

    try {
      const fullDetail = await appointmentService.getById(appointment._id)
      setDetail(fullDetail)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleHistory(appointment: AppointmentItem) {
    setHistoryItem(appointment)
  }

  function handleReschedule(appointment: AppointmentItem) {
    setRescheduleData(appointment)
    setView('reschedule')
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailLoading(false)
    setDetail(null)
  }

  const summaryCards = [
    { label: 'Lịch hẹn hôm nay', value: summary.today, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', icon: 'calendar' },
    { label: 'Chờ xác nhận', value: summary.pending, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', icon: 'clock' },
    { label: 'Chưa thanh toán', value: summary.unpaid ?? 0, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', icon: 'payment' },
    { label: 'Cần xử lý', value: summary.need_attention ?? 0, iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: 'alert-circle' },
  ]

  return (
    <div>
      <PageHeader
        title="Lịch hẹn hệ thống"
        description="Rà soát và xử lý lịch hẹn admin theo dữ liệu thật, có lọc nhanh cho vận hành hằng ngày."
      />

      {view === 'list' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ['all', 'Tất cả'],
              ['today', 'Hôm nay'],
              ['upcoming', 'Sắp tới'],
              ['unpaid', 'Chưa thanh toán'],
              ['cancelled', 'Đã hủy'],
              ['need_attention', 'Cần xử lý'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setQuickFilter(value as QuickFilter)
                  setPage(1)
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  quickFilter === value
                    ? 'bg-brand-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={item.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-800">{item.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                    <Icon name={item.icon} className={`h-6 w-6 ${item.iconColor}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card mb-4 flex flex-col justify-between gap-3 p-4 md:flex-row">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                  <Icon name="search" className="h-4 w-4" />
                </span>
                <input
                  className="input w-full pl-9"
                  placeholder="Tìm mã lịch, bệnh nhân, SĐT, bác sĩ..."
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </div>
              <input
                type="date"
                className="input w-full"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setPage(1)
                }}
                title="Từ ngày"
              />
              <input
                type="date"
                className="input w-full"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setPage(1)
                }}
                title="Đến ngày"
              />
              <select
                className="input"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AppointmentStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="checked_in">Đã đến</option>
                <option value="in_progress">Đang khám</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
                <option value="no_show">Không đến khám</option>
              </select>
              <select
                className="input"
                value={paymentStatus}
                onChange={(event) => {
                  setPaymentStatus(event.target.value as PaymentStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Tất cả thanh toán</option>
                <option value="unpaid">Chưa thanh toán</option>
                <option value="partial">Thanh toán một phần</option>
                <option value="paid">Đã thanh toán</option>
                <option value="refunded">Đã hoàn tiền</option>
              </select>
              <select
                className="input"
                value={loaiKham}
                onChange={(event) => {
                  setLoaiKham(event.target.value as 'clinic' | '')
                  setPage(1)
                }}
              >
                <option value="">Tất cả loại khám</option>
                <option value="clinic">Phòng khám</option>
              </select>
            </div>

            <button
              onClick={() => setView('add')}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Icon name="plus" className="h-4 w-4" />
              Đặt lịch mới
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {filterDoctorId && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-200 text-blue-700">
                  <Icon name="users" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Đang lọc lịch hẹn của bác sĩ:</p>
                  <p className="text-base font-bold text-blue-700">{filterDoctorName || 'Đã chọn'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  searchParams.delete('doctor_id')
                  searchParams.delete('doctor_name')
                  setSearchParams(searchParams)
                  setPage(1)
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Icon name="x" className="h-4 w-4" />
                Xóa bộ lọc
              </button>
            </div>
          )}

          <AppointmentList
            appointments={appointments}
            loading={loading}
            onView={handleView}
            onHistory={handleHistory}
            onCancel={handleCancel}
            onReschedule={handleReschedule}
            onRestore={handleRestore}
            onHardDelete={handleHardDelete}
          />

          {!loading && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between rounded-lg border-t border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700">
                    Hiển thị trang <span className="font-medium">{pagination.page}</span> /{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={pagination.page <= 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      <Icon name="chevron-left" className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      <Icon name="chevron-right" className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'add' && (
        <AddAppointment
          onCancel={() => setView('list')}
          onSaved={async () => {
            setView('list')
            setPage(1)
            await fetchAppointments(1)
          }}
        />
      )}

      {view === 'reschedule' && rescheduleData && (
        <RescheduleAppointment
          appointment={rescheduleData}
          onCancel={() => setView('list')}
          onSaved={async () => {
            setView('list')
            await fetchAppointments(page)
          }}
        />
      )}

      {detailOpen && (
        <AppointmentDetail detail={detail} loading={detailLoading} onClose={closeDetail} />
      )}

      {historyItem && (
        <AppointmentHistoryModal appointment={historyItem} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  )
}
