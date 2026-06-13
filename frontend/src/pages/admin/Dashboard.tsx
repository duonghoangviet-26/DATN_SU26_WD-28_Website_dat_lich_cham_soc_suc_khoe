import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

const stats = [
  {
    label: 'Tổng người dùng',
    value: '1.248',
    icon: 'users',
    trend: '+12% so với tháng trước',
    trendUp: true,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    label: 'Bác sĩ hoạt động',
    value: '86',
    icon: 'doctor',
    trend: '+3 bác sĩ mới tháng này',
    trendUp: true,
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
  },
  {
    label: 'Lịch hẹn hôm nay',
    value: '34',
    icon: 'calendar',
    trend: '+8 so với hôm qua',
    trendUp: true,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    label: 'Doanh thu tháng',
    value: '52.4M ₫',
    icon: 'payment',
    trend: '+15% so với tháng trước',
    trendUp: true,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
]

const pending = [
  { label: 'Hồ sơ bác sĩ chờ duyệt', value: 5, to: '/admin/doctors', color: 'bg-orange-100 text-orange-700' },
  { label: 'Yêu cầu hoàn tiền chờ xử lý', value: 3, to: '/admin/payments', color: 'bg-red-100 text-red-700' },
  { label: 'Đánh giá 1–2 sao cần xem', value: 2, to: '/admin/reviews', color: 'bg-yellow-100 text-yellow-700' },
]

const recentActivities = [
  { label: 'Bác sĩ Nguyễn Minh Tuấn vừa đăng ký', time: '2 phút trước', icon: 'doctor', dot: 'bg-brand-500' },
  { label: 'Lịch hẹn #1042 đã hoàn tất', time: '15 phút trước', icon: 'calendar', dot: 'bg-green-500' },
  { label: 'Đánh giá mới từ Trần Thị Mai', time: '32 phút trước', icon: 'star', dot: 'bg-yellow-500' },
  { label: 'Thanh toán #P-0087 thành công', time: '1 giờ trước', icon: 'payment', dot: 'bg-blue-500' },
  { label: 'Tài khoản mới: Lê Văn Bình', time: '2 giờ trước', icon: 'users', dot: 'bg-purple-500' },
]

export default function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Tổng quan hoạt động hệ thống VitaFamily."
      />

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
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
            <div className="mt-4 flex items-center gap-1.5">
              <span className={`text-xs font-medium ${s.trendUp ? 'text-green-600' : 'text-red-500'}`}>
                {s.trendUp ? '↑' : '↓'}
              </span>
              <span className="text-xs text-slate-500">{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Cần xử lý */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100">
              <Icon name="alert-circle" className="h-3.5 w-3.5 text-orange-600" />
            </span>
            Cần xử lý
          </h2>
          <ul className="space-y-2.5">
            {pending.map((p) => (
              <li key={p.label}>
                <Link
                  to={p.to}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="text-sm text-slate-600">{p.label}</span>
                  <span className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.color}`}>
                    {p.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Hoạt động gần đây */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100">
              <Icon name="clock" className="h-3.5 w-3.5 text-brand-600" />
            </span>
            Hoạt động gần đây
          </h2>
          <ul className="space-y-3.5">
            {recentActivities.map((a, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Icon name={a.icon} className="h-4 w-4 text-slate-500" />
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${a.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{a.label}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{a.time}</span>
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
