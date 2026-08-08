import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { RevenueDailyStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import {
  clinicDate,
  clinicDateMonthsAgo,
  formatCompactCurrency,
  formatCurrency,
  formatShortDate,
  getErrorMessage,
} from './chart-utils'

type RevenuePeriod = '7d' | '30d' | '3m' | '1y'

const PERIOD_OPTIONS: Array<{ value: RevenuePeriod; label: string }> = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: '3m', label: '3 tháng' },
  { value: '1y', label: '1 năm' },
]

function revenuePeriodStart(period: RevenuePeriod) {
  if (period === '7d') return clinicDate(-6)
  if (period === '30d') return clinicDate(-29)
  if (period === '3m') return clinicDateMonthsAgo(3)
  return clinicDateMonthsAgo(12)
}

function clinicDateFromDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function fillDailyRevenueData(start: string, end: string, rows: RevenueDailyStatistic[]) {
  const valueByDate = new Map(rows.map((item) => [item.ngay, item]))
  const current = new Date(`${start}T00:00:00+07:00`)
  const endDate = new Date(`${end}T00:00:00+07:00`)
  const result: RevenueDailyStatistic[] = []

  while (current <= endDate) {
    const ngay = clinicDateFromDate(current)
    result.push(valueByDate.get(ngay) ?? { ngay, da_thu: 0, da_xuat_hoa_don: 0 })
    current.setDate(current.getDate() + 1)
  }

  return result
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2.5 text-xs text-white shadow-lg">
      <p className="mb-2 font-semibold">Ngày {formatShortDate(label)}</p>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="mt-1 flex items-center justify-between gap-5">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <strong>{formatCurrency(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function RevenueTrendChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [period, setPeriod] = useState<RevenuePeriod>('7d')
  const [data, setData] = useState<RevenueDailyStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const startDate = revenuePeriodStart(period)
    thongKeService.getRevenueByDay(startDate, clinicDate())
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

    return () => { active = false }
  }, [period, refreshVersion])

  const startDate = revenuePeriodStart(period)
  const endDate = clinicDate()
  const chartData = useMemo(() => fillDailyRevenueData(startDate, endDate, data), [data, endDate, startDate])

  return (
    <ChartCard
      title="Xu hướng doanh thu"
      subtitle="So sánh số tiền đã thu và tổng giá trị hóa đơn theo từng ngày."
      icon="trending"
      iconBackgroundClassName="bg-blue-100"
      iconClassName="text-blue-600"
      loading={loading && !hasLoaded}
      empty={!chartData.length}
      error={error}
      action={(
        <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Khoảng thời gian doanh thu">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 motion-reduce:transition-none ${
                period === option.value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    >
      <div className="h-72 w-full" aria-label="Biểu đồ xu hướng doanh thu">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="collectedRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="invoicedRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="ngay"
              tickFormatter={formatShortDate}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              minTickGap={18}
              dy={8}
            />
            <YAxis
              tickFormatter={formatCompactCurrency}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              width={58}
            />
            <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="da_thu"
              name="Đã thu"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#collectedRevenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="da_xuat_hoa_don"
              name="Đã xuất hóa đơn"
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#invoicedRevenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Đã thu</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Đã xuất hóa đơn</span>
      </div>
    </ChartCard>
  )
}
