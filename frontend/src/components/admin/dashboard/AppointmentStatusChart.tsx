import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { AppointmentStatusStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicDate, clinicMonthStart, clinicYearStart, getErrorMessage } from './chart-utils'

type AppointmentStatusPeriod = 'month' | 'year'

const PERIOD_OPTIONS: Array<{ value: AppointmentStatusPeriod; label: string }> = [
  { value: 'month', label: '1 tháng' },
  { value: 'year', label: '1 năm' },
]

const STATUS_META = {
  cho_xac_nhan: { label: 'Chờ xác nhận', color: '#f59e0b' },
  da_xac_nhan: { label: 'Đã xác nhận', color: '#3b82f6' },
  hoan_thanh: { label: 'Hoàn thành', color: '#16a34a' },
  huy: { label: 'Đã hủy', color: '#ef4444' },
}

export default function AppointmentStatusChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [period, setPeriod] = useState<AppointmentStatusPeriod>('month')
  const [data, setData] = useState<AppointmentStatusStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const startDate = period === 'month' ? clinicMonthStart() : clinicYearStart()
    thongKeService.getAppointmentStatuses(startDate, clinicDate())
      .then((rows) => {
        if (active) {
          setData(rows)
          setHasLoaded(true)
        }
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, refreshVersion])

  const chartData = useMemo(() => data.map((item) => ({
    ...item,
    name: STATUS_META[item.trang_thai].label,
    color: STATUS_META[item.trang_thai].color,
  })), [data])
  const total = data.reduce((sum, item) => sum + item.so_luong, 0)
  const subtitle = period === 'month'
    ? 'Phân bổ lịch hẹn theo trạng thái trong tháng hiện tại.'
    : 'Phân bổ lịch hẹn theo trạng thái trong năm hiện tại.'

  return (
    <ChartCard
      title="Trạng thái lịch hẹn"
      subtitle={subtitle}
      icon="calendar"
      iconBackgroundClassName="bg-purple-100"
      iconClassName="text-purple-600"
      loading={loading && !hasLoaded}
      empty={!data.length}
      error={error}
      action={
        <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Khoảng thời gian lịch hẹn">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300 motion-reduce:transition-none ${
                period === option.value
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative h-56 w-full" aria-label="Biểu đồ trạng thái lịch hẹn">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="so_luong"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            >
              {chartData.map((item) => <Cell key={item.trang_thai} fill={item.color} />)}
            </Pie>
            <Tooltip
              formatter={(value: number | string | undefined, name: string | undefined) => [`${value ?? 0} lịch`, name ?? '']}
              contentStyle={{ border: 0, borderRadius: 8, background: '#0f172a', color: '#fff', fontSize: 12 }}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl font-bold text-slate-800">{total}</strong>
          <span className="text-xs text-slate-500">lịch hẹn</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {chartData.map((item) => (
          <div key={item.trang_thai} className="flex min-w-0 items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-slate-600">{item.name}</span>
            <strong className="ml-auto text-slate-800">{item.so_luong}</strong>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
