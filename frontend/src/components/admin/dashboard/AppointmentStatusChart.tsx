import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { thongKeService } from '@/services/thong-ke.service'
import type { AppointmentStatusStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicDate, getErrorMessage } from './chart-utils'

const STATUS_META = {
  cho_xac_nhan: { label: 'Chờ xác nhận', color: '#f59e0b' },
  da_xac_nhan: { label: 'Đã xác nhận', color: '#3b82f6' },
  hoan_thanh: { label: 'Hoàn thành', color: '#16a34a' },
  huy: { label: 'Đã hủy', color: '#ef4444' },
}

export default function AppointmentStatusChart({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [data, setData] = useState<AppointmentStatusStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    thongKeService.getAppointmentStatuses(clinicDate(-29), clinicDate())
      .then((rows) => { if (active) setData(rows) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshVersion])

  const chartData = useMemo(() => data.map((item) => ({
    ...item,
    name: STATUS_META[item.trang_thai].label,
    color: STATUS_META[item.trang_thai].color,
  })), [data])
  const total = data.reduce((sum, item) => sum + item.so_luong, 0)

  return (
    <ChartCard
      title="Trạng thái lịch hẹn"
      subtitle="Phân bổ lịch hẹn theo trạng thái trong 30 ngày gần nhất."
      icon="calendar"
      iconBackgroundClassName="bg-purple-100"
      iconClassName="text-purple-600"
      loading={loading}
      empty={!data.length}
      error={error}
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
