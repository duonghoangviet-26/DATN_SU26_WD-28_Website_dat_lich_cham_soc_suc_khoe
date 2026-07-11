import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { doctorProfileService } from '@/services/doctor-profile.service'
import type { DoctorStats, DoctorReview, DoctorTodayOverview, AppointmentStatus } from '@/types'
import { formatPrice, formatDate } from '@/utils/format'
import { APPOINTMENT_STATUS_LABEL } from '@/utils/constants'

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow', confirmed: 'blue', checked_in: 'blue', in_progress: 'yellow',
  waiting_doctor_confirm: 'yellow', completed: 'green', cancelled: 'red', no_show: 'red',
}

function formatTodayHeader(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${DAY_NAMES[now.getDay()]}, ${dd}/${mm}/${now.getFullYear()}`
}

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
  const navigate = useNavigate()
  const [stats, setStats] = useState<DoctorStats | null>(null)
  const [reviews, setReviews] = useState<DoctorReview[]>([])
  const [overview, setOverview] = useState<DoctorTodayOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      doctorProfileService.getStats(),
      doctorProfileService.getReviews(),
      doctorProfileService.getTodayOverview(),
    ]).then(([s, r, o]) => {
      setStats(s)
      setReviews(r)
      setOverview(o)
    }).catch(() => {
      setError(true)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Đang tải...</div>
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
        <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-600">Không tải được dữ liệu tổng quan. Vui lòng thử lại sau.</p>
      </div>
    )
  }

  const isTodayEmpty = !overview || (overview.tong_lich_hen === 0 && !overview.ca_lam_viec)

  const todayCards = overview ? [
    { label: 'Tổng lịch hẹn', value: overview.tong_lich_hen, iconBg: 'bg-slate-100', iconColor: 'text-slate-600', icon: 'calendar' },
    { label: 'Chờ khám', value: overview.cho_kham, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', icon: 'clock' },
    { label: 'Đang khám', value: overview.dang_kham, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: 'refresh-cw' },
    { label: 'Hoàn thành', value: overview.hoan_thanh, iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: 'check' },
  ] : []

  const statCards = stats ? [
    { label: 'Tổng lượt khám', value: stats.tong_luot_kham.toString(), iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: 'users', sub: 'tích lũy' },
    { label: 'Tháng này', value: stats.thang_nay.toString(), iconBg: 'bg-brand-100', iconColor: 'text-brand-600', icon: 'calendar', sub: `hoàn thành ${stats.ty_le_hoan_thanh}%` },
    { label: 'Đánh giá', value: stats.diem_danh_gia.toFixed(1), iconBg: 'bg-amber-100', iconColor: 'text-amber-600', icon: 'star', sub: `${stats.so_danh_gia} lượt đánh giá` },
    { label: 'Doanh thu tháng', value: formatPrice(stats.doanh_thu_thang), iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: 'payment', sub: `hủy ${stats.ty_le_huy}%` },
  ] : []

  return (
    <div>
      <PageHeader
        title={overview ? `Xin chào, Bác sĩ ${overview.ho_ten}` : 'Tổng quan'}
        description={overview ? `${overview.chuyen_khoa} · Hôm nay: ${formatTodayHeader()}` : formatTodayHeader()}
      />

      {/* ── Hôm nay ── */}
      <div className="card mb-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100">
            <Icon name="clock" className="h-3.5 w-3.5 text-brand-600" />
          </span>
          Công việc hôm nay
        </h2>

        {isTodayEmpty ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Icon name="calendar" className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-500">Hôm nay bạn không có ca làm việc hoặc lịch hẹn nào.</p>
          </div>
        ) : (
          <>
            {/* Ca làm việc / phòng / y tá */}
            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ca làm việc</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {overview!.ca_lam_viec
                    ? `${overview!.ca_lam_viec.gio_bat_dau} - ${overview!.ca_lam_viec.gio_ket_thuc}`
                    : 'Không có ca làm việc hôm nay'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phòng khám</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {overview!.phong_kham ?? 'Chưa có phòng khám hôm nay'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Y tá hỗ trợ</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {overview!.y_ta_ho_tro ?? 'Chưa phân công y tá'}
                </p>
              </div>
            </div>

            {/* Đếm theo trạng thái */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {todayCards.map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
                    <Icon name={c.icon} className={`h-4 w-4 ${c.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">{c.value}</p>
                    <p className="text-xs text-slate-500">{c.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Danh sách lịch hẹn gần nhất */}
            {overview!.lich_hen_gan_nhat.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lịch hẹn gần nhất</p>
                  <button
                    onClick={() => navigate('/doctor/appointments')}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Xem tất cả →
                  </button>
                </div>
                <ul className="divide-y divide-slate-100">
                  {overview!.lich_hen_gan_nhat.map((a) => (
                    <li
                      key={a.id}
                      onClick={() => navigate('/doctor/appointments')}
                      className="flex cursor-pointer items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-sm font-semibold text-slate-700">{a.gio_kham}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{a.benh_nhan}</p>
                          {a.ten_dich_vu && <p className="text-xs text-slate-400">{a.ten_dich_vu}</p>}
                        </div>
                      </div>
                      <Badge color={STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Thống kê hành nghề ── */}
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
