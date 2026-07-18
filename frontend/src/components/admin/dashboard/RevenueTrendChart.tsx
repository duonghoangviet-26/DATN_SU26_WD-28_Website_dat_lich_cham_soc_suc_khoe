import { useEffect, useState } from 'react'
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
  formatCompactCurrency,
  formatCurrency,
  formatShortDate,
  getErrorMessage,
} from './chart-utils'

type Period = 7 | 30

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

export default function RevenueTrendChart() {
  const [period, setPeriod] = useState<Period>(7)
  const [data, setData] = useState<RevenueDailyStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    thongKeService.getRevenueByDay(clinicDate(-(period - 1)), clinicDate())
      .then((rows) => {
        if (active) setData(rows)
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [period])

  return (
    <ChartCard
      title="Xu hướng doanh thu"
      subtitle="Đối chiếu khoản ThanhToan đã thu và tổng giá trị HoaDon theo từng ngày."
      icon="trending"
      iconBackgroundClassName="bg-blue-100"
      iconClassName="text-blue-600"
      loading={loading}
      empty={!data.length}
      error={error}
      action={(
        <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Khoảng thời gian doanh thu">
          {([7, 30] as Period[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                period === value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-pressed={period === value}
            >
              {value} ngày
            </button>
          ))}
        </div>
      )}
    >
      <div className="h-72 w-full" aria-label="Biểu đồ xu hướng doanh thu">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
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
