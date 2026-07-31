import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { NewPatientStatistic, NewPatientStatisticMode } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicMonth, clinicYear, getErrorMessage } from './chart-utils'

const VIEW_OPTIONS: Array<{ mode: NewPatientStatisticMode; label: string }> = [
  { mode: 'month', label: '1 tháng' },
  { mode: 'year', label: '1 năm' },
]

export default function NewPatientsChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [mode, setMode] = useState<NewPatientStatisticMode>('month')
  const [data, setData] = useState<NewPatientStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const value = mode === 'month' ? clinicMonth() : clinicYear()
    thongKeService.getNewPatients(mode, value)
      .then((rows) => {
        if (active) {
          setData(rows)
          setHasLoaded(true)
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [mode, refreshVersion])

  const chartData = useMemo(() => data.map((item) => {
    if ('tuan' in item) {
      return {
        ...item,
        label: item.label,
        tooltipLabel: `${item.label} (ngày ${item.tu}-${item.den})`,
      }
    }

    const label = item.label || `T${item.thang}`
    return {
      ...item,
      label,
      tooltipLabel: `Tháng ${item.thang}`,
    }
  }), [data])

  const subtitle = mode === 'month'
    ? 'Số tài khoản bệnh nhân mới được tạo theo từng tuần trong tháng hiện tại.'
    : 'Số tài khoản bệnh nhân mới được tạo theo từng tháng trong năm hiện tại.'

  return (
    <ChartCard
      title="Bệnh nhân mới"
      subtitle={subtitle}
      icon="users"
      iconBackgroundClassName="bg-emerald-100"
      iconClassName="text-emerald-600"
      loading={loading && !hasLoaded}
      empty={!chartData.length}
      error={error}
      action={
        <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Khoảng thời gian">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 motion-reduce:transition-none ${
                mode === option.mode
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
              aria-pressed={mode === option.mode}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div
        className="h-80 w-full"
        aria-label={mode === 'month' ? 'Biểu đồ bệnh nhân mới theo tuần' : 'Biểu đồ bệnh nhân mới theo tháng'}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number | string | undefined) => [`${value ?? 0} bệnh nhân`, 'Mới']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ''}
              contentStyle={{ border: 0, borderRadius: 8, background: '#0f172a', color: '#fff', fontSize: 12 }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: '#ecfdf5' }}
            />
            <Bar
              dataKey="so_luong"
              name="Bệnh nhân mới"
              fill="#16a34a"
              radius={[5, 5, 0, 0]}
              maxBarSize={38}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
