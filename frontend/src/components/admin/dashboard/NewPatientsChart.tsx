import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { MonthlyNewPatientStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicYear, getErrorMessage } from './chart-utils'

export default function NewPatientsChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [data, setData] = useState<MonthlyNewPatientStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    thongKeService.getMonthlyNewPatients(clinicYear())
      .then((rows) => { if (active) setData(rows) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshVersion])

  return (
    <ChartCard
      title="Bệnh nhân mới"
      subtitle="Đếm tài khoản bệnh nhân theo NguoiDung.ngay_tao trong năm hiện tại."
      icon="users"
      iconBackgroundClassName="bg-emerald-100"
      iconClassName="text-emerald-600"
      loading={loading}
      empty={!data.length}
      error={error}
      pulseKey={refreshVersion}
    >
      <div className="h-80 w-full" aria-label="Biểu đồ bệnh nhân mới theo tháng">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="thang"
              tickFormatter={(value) => `T${value}`}
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
              labelFormatter={(value) => `Tháng ${value}`}
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
