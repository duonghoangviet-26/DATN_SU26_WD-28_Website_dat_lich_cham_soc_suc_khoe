import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '@/components/admin/icons'
import PageHeader from '@/components/common/PageHeader'
import { dashboardService } from '@/services/dashboard.service'
import type { AdminDashboardSummary } from '@/types'

const EMPTY_SUMMARY: AdminDashboardSummary = {
  appointments_today: 0,
  doctors_active: 0,
  revenue: {
    invoiced_total: 0,
    collected_total: 0,
    outstanding_total: 0,
  },
  generated_at: '',
}

const QUICK_LINKS = [
  { label: 'Quản lý lịch hẹn', to: '/admin/appointments', icon: 'calendar' },
  { label: 'Quản lý thanh toán', to: '/admin/payments', icon: 'payment' },
  { label: 'Quản lý đánh giá', to: '/admin/reviews', icon: 'star' },
  { label: 'Phòng khám & chuyên khoa', to: '/admin/clinics', icon: 'hospital' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(value: string) {
  if (!value) return 'Chưa cập nhật'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function Dashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadSummary() {
      setLoading(true)
      setError('')
      try {
        const data = await dashboardService.getSummary()
        if (active) {
          setSummary(data)
        }
      } catch (err: any) {
        if (active) {
          setError(err?.response?.data?.message || err.message || 'Không tải được dashboard')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      active = false
    }
  }, [])

  const stats = [
    {
      label: 'Lịch hẹn hôm nay',
      value: String(summary.appointments_today),
      icon: 'calendar',
      helper: 'Tổng lịch hẹn có ngày_kham trong hôm nay.',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Bác sĩ đang hoạt động',
      value: String(summary.doctors_active),
      icon: 'doctor',
      helper: "Đếm từ BacSi.trang_thai = 'active'.",
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-600',
    },
    {
      label: 'Doanh thu đã thu',
      value: formatCurrency(summary.revenue.collected_total),
      icon: 'payment',
      helper: "Tong ThanhToan.status = 'paid'.",
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Doanh thu xuất hóa đơn',
      value: formatCurrency(summary.revenue.invoiced_total),
      icon: 'file-text',
      helper: 'Tổng tong_thanh_toan trên hóa đơn.',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Tổng quan nhanh từ dữ liệu thật của lịch hẹn, hóa đơn, thanh toán và bác sĩ."
      />

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-800">
                  {loading ? '...' : item.value}
                </p>
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                <Icon name={item.icon} className={`h-6 w-6 ${item.iconColor}`} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
              <Icon name="payment" className="h-3.5 w-3.5 text-blue-600" />
            </span>
            Tổng quan doanh thu
          </h2>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Đã thu</span>
              <strong className="text-slate-800">
                {loading ? '...' : formatCurrency(summary.revenue.collected_total)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Đã xuất hóa đơn</span>
              <strong className="text-slate-800">
                {loading ? '...' : formatCurrency(summary.revenue.invoiced_total)}
              </strong>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-slate-600">
              <span>Còn cần thu</span>
              <strong className="text-orange-600">
                {loading ? '...' : formatCurrency(summary.revenue.outstanding_total)}
              </strong>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Cập nhật lúc: {formatDateTime(summary.generated_at)}
          </p>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100">
              <Icon name="dashboard" className="h-3.5 w-3.5 text-brand-600" />
            </span>
            Truy cập nhanh
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Icon name={item.icon} className="h-5 w-5 text-brand-600" />
                </span>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

