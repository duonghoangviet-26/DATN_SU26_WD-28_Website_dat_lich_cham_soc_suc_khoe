import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, User, Star, AlertCircle, ArrowRight } from 'lucide-react'

import Icon from '@/components/admin/icons'
import AppointmentStatusChart from '@/components/admin/dashboard/AppointmentStatusChart'
import DoctorRevenueChart from '@/components/admin/dashboard/DoctorRevenueChart'
import NewPatientsChart from '@/components/admin/dashboard/NewPatientsChart'
import RevenueTrendChart from '@/components/admin/dashboard/RevenueTrendChart'
import TopServicesTable from '@/components/admin/dashboard/TopServicesTable'
import { AdminMotionGroup, AdminMotionItem } from '@/components/admin/motion/AdminMotion'
import PageHeader from '@/components/common/PageHeader'
import RevenueDetailsModal from '@/components/admin/dashboard/RevenueDetailsModal'
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime'
import { dashboardService } from '@/services/dashboard.service'
import type { AdminDashboardSummary } from '@/types'

const EMPTY_SUMMARY: AdminDashboardSummary = {
  appointments_today: { value: 0, growth: 0 },
  doctors_active: { value: 0, growth: 0 },
  revenue: {
    invoiced_total: 0,
    collected_total: 0,
    outstanding_total: 0,
    growth: 0
  },
  upcoming_appointments: [],
  recent_bad_reviews: [],
  generated_at: '',
}

const QUICK_LINKS = [
  { label: 'Quản lý lịch hẹn', to: '/admin/appointments', icon: 'calendar' },
  { label: 'Quản lý thanh toán', to: '/admin/payments', icon: 'payment' },
  { label: 'Quản lý đánh giá', to: '/admin/reviews', icon: 'star' },
  { label: 'Phòng khám & chuyên khoa', to: '/admin/clinics', icon: 'hospital' },
]

const ADMIN_DASHBOARD_REFRESH_MS = 15000

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTimeOnly(value: string) {
  if (!value) return ''
  return value.substring(0, 5)
}

function DashboardStatCard({ item, loading }: {
  item: {
    label: string
    value: number
    growth?: number
    format: (value: number) => string
    icon: string
    helper: string
    iconBg: string
    iconColor: string
    onClick?: () => void
  }
  loading: boolean
}) {
  return (
    <div 
      className={`card p-5 ${item.onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      onClick={item.onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-800">
              {loading ? '...' : item.format(item.value)}
            </p>
            {item.growth !== undefined && !loading && (
              <span className={`text-xs font-medium ${item.growth > 0 ? 'text-emerald-600' : (item.growth < 0 ? 'text-red-600' : 'text-slate-400')}`}>
                {item.growth > 0 ? '▲' : (item.growth < 0 ? '▼' : '-')} {Math.abs(item.growth)}%
              </span>
            )}
          </div>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
          <Icon name={item.icon} className={`h-6 w-6 ${item.iconColor}`} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{item.helper}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AdminDashboardSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false)
  const { connection, versions } = useDashboardRealtime()

  useEffect(() => {
    const refresh = () => setRefreshTick((tick) => tick + 1)
    const intervalId = window.setInterval(refresh, ADMIN_DASHBOARD_REFRESH_MS)
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshOnVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSummary() {
      setError('')
      try {
        const data = await dashboardService.getSummary(controller.signal)
        if (!controller.signal.aborted) {
          setSummary(data)
        }
      } catch (err: any) {
        if (!controller.signal.aborted && err?.code !== 'ERR_CANCELED') {
          setError(err?.response?.data?.message || err.message || 'Không tải được dashboard')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadSummary()
    return () => controller.abort()
  }, [versions.summary, refreshTick])

  const stats = [
    {
      label: 'Lịch hẹn hôm nay',
      value: summary.appointments_today.value,
      growth: summary.appointments_today.growth,
      format: (value: number) => String(Math.round(value)),
      icon: 'calendar',
      helper: 'So với hôm qua.',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Bác sĩ đang hoạt động',
      value: summary.doctors_active.value,
      format: (value: number) => String(Math.round(value)),
      icon: 'doctor',
      helper: 'Số bác sĩ đang hoạt động trong hệ thống.',
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-600',
    },
    {
      id: 'revenue-collected',
      label: 'Doanh thu đã thu',
      value: summary.revenue.collected_total,
      growth: summary.revenue.growth,
      format: formatCurrency,
      icon: 'payment',
      helper: 'Tháng này so với tháng trước.',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => setIsRevenueModalOpen(true)
    },
    {
      label: 'Doanh thu xuất hóa đơn',
      value: summary.revenue.invoiced_total,
      format: formatCurrency,
      icon: 'file-text',
      helper: 'Tổng giá trị đã xuất trên các hóa đơn.',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ]

  return (
    <AdminMotionGroup>
      <AdminMotionItem>
        <PageHeader
          title="Tổng quan"
          description="Tổng quan nhanh từ dữ liệu lịch hẹn, hóa đơn, thanh toán và bác sĩ."
        />
      </AdminMotionItem>

      {connection !== 'connected' && (
        <div className={`mb-5 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
          connection === 'disconnected'
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-blue-200 bg-blue-50 text-blue-800'
        }`} role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${connection === 'disconnected' ? 'bg-amber-600' : 'animate-pulse bg-blue-600 motion-reduce:animate-none'}`} />
          {connection === 'disconnected' ? 'Mất kết nối thời gian thực, đang thử lại' : 'Đang kết nối thời gian thực...'}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AdminMotionItem>
        <AdminMotionGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <AdminMotionItem key={item.label}>
              <DashboardStatCard item={item} loading={loading} />
            </AdminMotionItem>
          ))}
        </AdminMotionGroup>
      </AdminMotionItem>

      <AdminMotionItem>
        <AdminMotionGroup className="mt-6 grid min-w-0 gap-5 lg:grid-cols-3">
        <AdminMotionItem className="min-w-0 lg:col-span-2">
          <RevenueTrendChart refreshVersion={versions.revenue + refreshTick} />
        </AdminMotionItem>
        <AdminMotionItem className="min-w-0">
          <AppointmentStatusChart refreshVersion={versions.appointments + refreshTick} />
        </AdminMotionItem>
        </AdminMotionGroup>
      </AdminMotionItem>

      <AdminMotionItem>
        <AdminMotionGroup className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <AdminMotionItem className="min-w-0">
          <DoctorRevenueChart refreshVersion={versions.doctors + refreshTick} />
        </AdminMotionItem>
        <AdminMotionItem className="min-w-0">
          <NewPatientsChart refreshVersion={versions.patients + refreshTick} />
        </AdminMotionItem>
        </AdminMotionGroup>
      </AdminMotionItem>

      <AdminMotionItem className="mt-5 min-w-0">
        <TopServicesTable refreshVersion={versions.services + refreshTick} />
      </AdminMotionItem>

      <AdminMotionItem>
        <AdminMotionGroup className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* Lịch hẹn sắp tới */}
          <AdminMotionItem className="card flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                </span>
                Sắp diễn ra
              </h2>
              <Link to="/admin/appointments" className="text-xs font-medium text-brand-600 hover:text-brand-700">Xem tất cả</Link>
            </div>
            
            <div className="flex-1 space-y-3 overflow-hidden">
              {loading ? (
                <div className="text-sm text-slate-500">Đang tải...</div>
              ) : summary.upcoming_appointments.length > 0 ? (
                summary.upcoming_appointments.map(app => (
                  <div key={app._id} className="group relative flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50" onClick={() => navigate('/admin/appointments')}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">
                      {formatTimeOnly(app.gio_kham)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{app.ten_khach || 'Khách'}</p>
                      <p className="truncate text-xs text-slate-500">BS. {app.doctor_id?.ho_ten || 'Trống'}</p>
                    </div>
                    <div className="self-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${app.status === 'checked_in' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                        {app.status === 'checked_in' ? 'Đã đến' : 'Sắp tới'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <User className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">Không có lịch sắp diễn ra</p>
                </div>
              )}
            </div>
          </AdminMotionItem>

          {/* Đánh giá cần chú ý */}
          <AdminMotionItem className="card flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                </span>
                Đánh giá cần lưu ý
              </h2>
              <Link to="/admin/reviews" className="text-xs font-medium text-brand-600 hover:text-brand-700">Quản lý</Link>
            </div>
            
            <div className="flex-1 space-y-3 overflow-hidden">
              {loading ? (
                <div className="text-sm text-slate-500">Đang tải...</div>
              ) : summary.recent_bad_reviews.length > 0 ? (
                summary.recent_bad_reviews.map(review => (
                  <div key={review._id} className="group relative cursor-pointer rounded-lg border border-red-100 bg-red-50/50 p-3 transition-colors hover:border-red-200 hover:bg-red-50" onClick={() => navigate('/admin/reviews')}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < review.so_sao ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(review.ngay_tao).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">"{review.noi_dung}"</p>
                    <p className="mt-1 text-[10px] text-slate-500">- Bệnh nhân: {review.user_id?.ho_ten || 'Ẩn danh'} khám với BS. {review.doctor_id?.ho_ten || 'Trống'}</p>
                  </div>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <Star className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">Tuyệt vời! Không có đánh giá tệ nào gần đây.</p>
                </div>
              )}
            </div>
          </AdminMotionItem>

          {/* Truy cập nhanh */}
          <AdminMotionItem className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100">
                <Icon name="dashboard" className="h-3.5 w-3.5 text-brand-600" />
              </span>
              Truy cập nhanh
            </h2>

            <div className="flex flex-col gap-3">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition-all hover:border-brand-200 hover:bg-brand-50 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm transition-transform group-hover:scale-105">
                      <Icon name={item.icon} className="h-4 w-4 text-brand-600" />
                    </span>
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
          </AdminMotionItem>
        </AdminMotionGroup>
      </AdminMotionItem>
      
      <RevenueDetailsModal 
        isOpen={isRevenueModalOpen} 
        onClose={() => setIsRevenueModalOpen(false)} 
      />
    </AdminMotionGroup>
  )
}
