import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { DoctorRevenueStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicDate, clinicMonthStart, clinicYearStart, formatCompactCurrency, formatCurrency, getErrorMessage } from './chart-utils'

function shortDoctorName(value: string) {
  return value.length > 20 ? `${value.slice(0, 18)}…` : value
}

type DoctorRevenuePeriod = 'month' | 'year' | 'all'

const PERIOD_OPTIONS: Array<{ value: DoctorRevenuePeriod; label: string }> = [
  { value: 'month', label: '1 tháng' },
  { value: 'year', label: '1 năm' },
  { value: 'all', label: 'Tất cả' },
]

export default function DoctorRevenueChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [period, setPeriod] = useState<DoctorRevenuePeriod>('month')
  const [data, setData] = useState<DoctorRevenueStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const startDate = period === 'month' ? clinicMonthStart() : (period === 'year' ? clinicYearStart() : '')
    const endDate = period === 'all' ? '' : clinicDate()

    thongKeService.getDoctorRevenue(startDate, endDate)
      .then((rows) => { if (active) setData(rows) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, refreshVersion])

  const subtitle = period === 'month'
    ? 'Tổng số tiền đã thu theo bác sĩ phụ trách lịch hẹn trong tháng này.'
    : period === 'year'
      ? 'Tổng số tiền đã thu theo bác sĩ phụ trách lịch hẹn trong năm nay.'
      : 'Tổng số tiền đã thu theo bác sĩ phụ trách lịch hẹn từ trước đến nay.'

  return (
    <ChartCard
      title="Doanh thu theo bác sĩ"
      subtitle={subtitle}
      icon="doctor"
      iconBackgroundClassName="bg-brand-100"
      iconClassName="text-brand-600"
      loading={loading}
      empty={!data.length}
      error={error}
      action={
        <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Khoảng thời gian doanh thu">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 motion-reduce:transition-none ${
                period === option.value
                  ? 'bg-white text-brand-700 shadow-sm'
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
      <div className="h-80 w-full" aria-label="Biểu đồ doanh thu theo bác sĩ">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatCompactCurrency}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="ten_bac_si"
              tickFormatter={shortDoctorName}
              width={122}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#475569', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number | string | undefined) => [formatCurrency(Number(value ?? 0)), 'Doanh thu']}
              labelFormatter={(label) => String(label)}
              contentStyle={{ border: 0, borderRadius: 8, background: '#0f172a', color: '#fff', fontSize: 12 }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: '#eff6ff' }}
            />
            <Bar
              dataKey="doanh_thu"
              name="Doanh thu"
              fill="#4880ff"
              radius={[0, 5, 5, 0]}
              maxBarSize={26}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-slate-500">Hiển thị tối đa 8 bác sĩ có doanh thu cao nhất.</p>
    </ChartCard>
  )
}
