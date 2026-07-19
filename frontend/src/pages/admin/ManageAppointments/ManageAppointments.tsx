import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Icon from '@/components/admin/icons'
import { AdminMotionGroup, AdminMotionItem } from '@/components/admin/motion/AdminMotion'
import PageHeader from '@/components/common/PageHeader'
import { appointmentService } from '@/services/appointment.service'
import { subscribeAdminRealtime } from '@/services/realtime.service'
import type {
  AppointmentItem,
  AppointmentPagination,
  AppointmentStatus,
  AppointmentSummary,
  PaymentStatus,
} from '@/types'

import AppointmentDetail from './AppointmentDetail'
import AppointmentHistoryModal from './AppointmentHistoryModal'
import AppointmentList from './AppointmentList'
import RescheduleAppointment from './RescheduleAppointment'

type ViewMode = 'list' | 'reschedule'
type QuickFilter = 'all' | 'today' | 'upcoming' | 'unpaid' | 'cancelled' | 'need_attention' | 'proxy_booking'
type BookingScope = '' | 'self' | 'proxy'

const EMPTY_SUMMARY: AppointmentSummary = {
  today: 0,
  pending: 0,
  confirmed: 0,
  completed: 0,
  in_progress: 0,
  cancelled: 0,
  unpaid: 0,
  need_attention: 0,
  proxy_booking: 0,
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
  const [bookingScope, setBookingScope] = useState<BookingScope>('')
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
        booking_scope: bookingScope || undefined,
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
  }, [debouncedKeyword, status, paymentStatus, loaiKham, bookingScope, startDate, endDate, page, filterDoctorId, quickFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  useEffect(() => subscribeAdminRealtime({
    'admin:appointment_created': () => fetchAppointments(page),
    'admin:appointment_updated': () => fetchAppointments(page),
    'admin:payment_updated': () => fetchAppointments(page),
  }), [fetchAppointments, page])

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
    { label: 'Đặt hộ', value: summary.proxy_booking ?? appointments.filter((item) => item.dat_ho).length, iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600', icon: 'users' },
  ]

  return (
    <AdminMotionGroup>
      <AdminMotionItem>
        <PageHeader
          title="Lịch hẹn hệ thống"
          description="Admin chỉ rà soát, dời lịch, hủy và theo dõi đặt hộ. Việc tạo lịch mới thuộc về người dùng hoặc lễ tân do liên quan trực tiếp tới thanh toán."
        />
      </AdminMotionItem>

      {view === 'list' && (
        <AdminMotionGroup>

          <AdminMotionItem className="mb-4 flex flex-wrap gap-2">
            {[
              ['all', 'Tất cả'],
              ['today', 'Hôm nay'],
              ['upcoming', 'Sắp tới'],
              ['unpaid', 'Chưa thanh toán'],
              ['cancelled', 'Đã hủy'],
              ['need_attention', 'Cần xử lý'],
              ['proxy_booking', 'Đặt hộ'],
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
          </AdminMotionItem>

          <AdminMotionGroup className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((item) => (
              <AdminMotionItem key={item.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-800">{item.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                    <Icon name={item.icon} className={`h-6 w-6 ${item.iconColor}`} />
                  </div>
                </div>
              </AdminMotionItem>
            ))}
          </AdminMotionGroup>

          <AdminMotionItem className="card mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
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
              <select
                className="input"
                value={bookingScope}
                onChange={(event) => {
                  setBookingScope(event.target.value as BookingScope)
                  setPage(1)
                }}
              >
                <option value="">Tất cả hình thức đặt</option>
                <option value="self">Tự đặt</option>
                <option value="proxy">Đặt hộ</option>
              </select>
            </div>
          </AdminMotionItem>

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

          <AdminMotionItem>
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
          </AdminMotionItem>

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
        </AdminMotionGroup>
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
    </AdminMotionGroup>
  )
}
