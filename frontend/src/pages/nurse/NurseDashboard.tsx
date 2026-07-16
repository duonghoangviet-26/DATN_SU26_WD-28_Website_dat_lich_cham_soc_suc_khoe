import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { useAuth } from '@/context/AuthContext'
import { nurseService } from '@/services/nurse.service'
import type { NurseDashboard as NurseDashboardData } from '@/types'
import { APPOINTMENT_STATUS_LABEL } from '@/utils/constants'

const STAT_CARDS: { key: keyof NurseDashboardData; label: string; icon: string }[] = [
  { key: 'tong_check_in', label: 'Đã check-in hôm nay', icon: 'calendar' },
  { key: 'dang_cho_kham', label: 'Đang chờ khám', icon: 'clock' },
  { key: 'dang_kham', label: 'Đang khám', icon: 'refresh-cw' },
  { key: 'cho_nhap_ho_so', label: 'Chờ nhập hồ sơ', icon: 'file-text' },
  { key: 'ho_so_cho_xac_nhan', label: 'Hồ sơ chờ bác sĩ xác nhận', icon: 'file-text' },
  { key: 'ho_so_can_sua', label: 'Hồ sơ cần chỉnh sửa', icon: 'edit' },
  { key: 'ho_so_da_xac_nhan', label: 'Hồ sơ đã xác nhận', icon: 'check' },
]

export default function NurseDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<NurseDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    nurseService.getDashboard()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title={`Chào ${data?.ten_y_ta || user?.ho_ten || 'y tá'}`}
        description="Tổng quan công việc hôm nay."
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error || !data ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được dữ liệu tổng quan. Vui lòng thử lại sau.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Bác sĩ đang hỗ trợ hôm nay */}
          <div className="card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Đang hỗ trợ hôm nay</p>
            {data.bac_si_ho_tro.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa được phân công ca nào hôm nay.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {data.bac_si_ho_tro.map((b) => (
                  <div key={b.doctor_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-700">{b.ten_bac_si ?? 'Không rõ'}</p>
                    <p className="text-xs text-slate-400">{b.chuyen_khoa ?? '—'} · {b.phong_kham ?? 'Chưa có phòng'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Số liệu */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {STAT_CARDS.map((s) => (
              <div key={s.key} className="card flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name={s.icon} className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">{data[s.key] as number}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Hàng đợi gần nhất */}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hàng đợi gần nhất</p>
              <Link to="/nurse/queue" className="text-xs font-semibold text-brand-600 hover:underline">Xem tất cả</Link>
            </div>
            {data.hang_doi_gan_nhat.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Icon name="calendar" className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">Chưa có bệnh nhân nào trong hàng đợi hôm nay.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.hang_doi_gan_nhat.map((q) => (
                  <Link
                    key={q.id}
                    to={`/nurse/appointments/${q.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-700">{q.benh_nhan}</p>
                      <p className="text-xs text-slate-400">{q.gio_kham} · {q.ma_lich_hen ?? q.id}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {APPOINTMENT_STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
