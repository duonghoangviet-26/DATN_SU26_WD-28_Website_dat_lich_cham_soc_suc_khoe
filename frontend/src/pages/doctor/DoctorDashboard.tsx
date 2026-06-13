import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { doctorProfileService } from '@/services/doctor-profile.service'
import type { DoctorStats, DoctorReview } from '@/types'
import { formatPrice, formatDate } from '@/utils/format'

function StarRow({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3.5 w-3.5 ${i <= count ? 'text-amber-400' : 'text-slate-200'}`}
          fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

export default function DoctorDashboard() {
  const [stats, setStats] = useState<DoctorStats | null>(null)
  const [reviews, setReviews] = useState<DoctorReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      doctorProfileService.getStats(),
      doctorProfileService.getReviews(),
    ]).then(([s, r]) => {
      setStats(s)
      setReviews(r)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Đang tải...</div>
  }

  const statCards = stats ? [
    { label: 'Tổng lượt khám', value: stats.tong_luot_kham.toString(), iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: 'users', sub: 'tích lũy' },
    { label: 'Tháng này', value: stats.thang_nay.toString(), iconBg: 'bg-brand-100', iconColor: 'text-brand-600', icon: 'calendar', sub: `hoàn thành ${stats.ty_le_hoan_thanh}%` },
    { label: 'Đánh giá', value: stats.diem_danh_gia.toFixed(1), iconBg: 'bg-amber-100', iconColor: 'text-amber-600', icon: 'star', sub: `${stats.so_danh_gia} lượt đánh giá` },
    { label: 'Doanh thu tháng', value: formatPrice(stats.doanh_thu_thang), iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: 'payment', sub: `hủy ${stats.ty_le_huy}%` },
  ] : []

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Thống kê hoạt động hành nghề của bạn."
      />

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500">{s.label}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
                <Icon name={s.icon} className={`h-6 w-6 ${s.iconColor}`} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Tỉ lệ */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100">
              <Icon name="trending" className="h-3.5 w-3.5 text-brand-600" />
            </span>
            Tỉ lệ hoạt động
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Hoàn thành', value: stats?.ty_le_hoan_thanh ?? 0, color: 'bg-green-500' },
              { label: 'Bị hủy', value: stats?.ty_le_huy ?? 0, color: 'bg-red-400' },
              { label: 'Khác', value: 100 - (stats?.ty_le_hoan_thanh ?? 0) - (stats?.ty_le_huy ?? 0), color: 'bg-slate-200' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-700">{item.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Đánh giá gần đây */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
              <Icon name="star" className="h-3.5 w-3.5 text-amber-600" />
            </span>
            Đánh giá gần đây
          </h2>
          <ul className="divide-y divide-slate-100">
            {reviews.slice(0, 4).map((r) => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {r.benh_nhan.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">{r.benh_nhan}</p>
                      <StarRow count={r.diem} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{r.noi_dung}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{formatDate(r.ngay_tao)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        * Số liệu hiện là dữ liệu mẫu — sẽ thay bằng dữ liệu thật khi kết nối database.
      </p>
    </div>
  )
}
