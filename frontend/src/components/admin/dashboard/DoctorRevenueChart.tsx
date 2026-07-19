import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { DoctorRevenueStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicMonth, formatCompactCurrency, formatCurrency, getErrorMessage } from './chart-utils'

function shortDoctorName(value: string) {
  return value.length > 20 ? `${value.slice(0, 18)}…` : value
}

export default function DoctorRevenueChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [data, setData] = useState<DoctorRevenueStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    thongKeService.getDoctorRevenue(clinicMonth())
      .then((rows) => { if (active) setData(rows) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshVersion])

  return (
    <ChartCard
      title="Doanh thu theo bác sĩ"
      subtitle="Tổng ThanhToan đã thu theo bác sĩ phụ trách lịch hẹn trong tháng này."
      icon="doctor"
      iconBackgroundClassName="bg-brand-100"
      iconClassName="text-brand-600"
      loading={loading}
      empty={!data.length}
      error={error}
      pulseKey={refreshVersion}
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
