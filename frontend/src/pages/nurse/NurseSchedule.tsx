import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { nurseService } from '@/services/nurse.service'
import type { NurseShift } from '@/types'
import { formatDate } from '@/utils/format'

const TH = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

const DAY_STATUS_COLOR: Record<string, 'green' | 'gray' | 'red'> = {
  lam_viec: 'green',
  nghi: 'gray',
  nghi_phep: 'red',
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Mặc định: từ hôm nay đến +6 ngày (một tuần).
function defaultRange() {
  const today = new Date()
  const to = new Date(today)
  to.setDate(to.getDate() + 6)
  return { from: toDateStr(today), to: toDateStr(to) }
}

export default function NurseSchedule() {
  const navigate = useNavigate()
  const init = defaultRange()

  const [items, setItems] = useState<NurseShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)

  useEffect(() => {
    setLoading(true)
    setError(false)
    nurseService.getSchedule({ from, to })
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [from, to])

  function shiftWeek(deltaDays: number) {
    const f = new Date(from); f.setDate(f.getDate() + deltaDays)
    const t = new Date(to); t.setDate(t.getDate() + deltaDays)
    setFrom(toDateStr(f)); setTo(toDateStr(t))
  }

  return (
    <div>
      <PageHeader
        title="Ca làm việc"
        description="Các ca bạn được phân công hỗ trợ bác sĩ — chỉ xem, do quản trị viên phân công."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Từ ngày</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Đến ngày</label>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => shiftWeek(-7)} className="btn-secondary text-sm">← Tuần trước</button>
          <button onClick={() => { const r = defaultRange(); setFrom(r.from); setTo(r.to) }} className="btn-secondary text-sm">Tuần này</button>
          <button onClick={() => shiftWeek(7)} className="btn-secondary text-sm">Tuần sau →</button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được ca làm việc. Vui lòng thử lại sau.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <Icon name="calendar" className="h-10 w-10 text-slate-200" />
          <p className="text-base font-medium text-slate-500">Bạn không có ca làm việc nào trong khoảng này.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className={TH}>Ngày</th>
                  <th className={TH}>Giờ ca</th>
                  <th className={TH}>Bác sĩ</th>
                  <th className={TH}>Chuyên khoa</th>
                  <th className={TH}>Phòng</th>
                  <th className={TH}>Số lịch</th>
                  <th className={TH}>Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{formatDate(s.ngay)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.gio_bat_dau && s.gio_ket_thuc ? `${s.gio_bat_dau}–${s.gio_ket_thuc}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.bac_si ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.chuyen_khoa ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phong_kham ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.so_lich_hen}</td>
                    <td className="px-4 py-3">
                      <Badge color={DAY_STATUS_COLOR[s.trang_thai_ngay] ?? 'gray'}>{s.trang_thai_ngay_label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/nurse/queue?date=${toDateStr(new Date(s.ngay))}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Icon name="eye" className="h-3 w-3" /> Xem bệnh nhân
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
