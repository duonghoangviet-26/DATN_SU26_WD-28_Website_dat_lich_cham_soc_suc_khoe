import { useEffect, useMemo, useState } from 'react'

import { thongKeService } from '@/services/thong-ke.service'
import type { TopServiceStatistic } from '@/types/thong-ke'
import ChartCard from './ChartCard'
import { clinicDate, formatCurrency, getErrorMessage } from './chart-utils'

export default function TopServicesTable() {
  const [data, setData] = useState<TopServiceStatistic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    thongKeService.getTopServices(clinicDate(-29), clinicDate())
      .then((rows) => { if (active) setData(rows) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const maxUsage = useMemo(() => Math.max(...data.map((item) => item.so_luot_dung), 1), [data])

  return (
    <ChartCard
      title="Dịch vụ phổ biến"
      subtitle="Top 5 hạng mục trên HoaDon.chi_tiet_thu_phi theo số lượt sử dụng trong 30 ngày gần nhất."
      icon="service"
      iconBackgroundClassName="bg-orange-100"
      iconClassName="text-orange-600"
      loading={loading}
      empty={!data.length}
      error={error}
    >
      <div className="overflow-hidden rounded-lg bg-slate-50/80">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px] gap-6 px-4 py-3 text-xs font-semibold text-slate-500 sm:grid">
          <span>Dịch vụ</span>
          <span className="text-right">Lượt sử dụng</span>
          <span className="text-right">Doanh thu</span>
        </div>
        <ol className="divide-y divide-slate-200">
          {data.map((item, index) => {
            const percentage = Math.max((item.so_luot_dung / maxUsage) * 100, 4)
            return (
              <li
                key={item.ten_dich_vu}
                className="grid gap-3 bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_120px_150px] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50 text-xs font-bold text-orange-700">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-800">{item.ten_dich_vu}</span>
                  </div>
                  <div className="ml-10 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between pl-10 text-xs sm:block sm:pl-0 sm:text-right">
                  <span className="text-slate-500 sm:hidden">Lượt sử dụng</span>
                  <strong className="text-sm text-slate-800">{item.so_luot_dung}</strong>
                </div>
                <div className="flex items-center justify-between pl-10 text-xs sm:block sm:pl-0 sm:text-right">
                  <span className="text-slate-500 sm:hidden">Doanh thu</span>
                  <strong className="text-sm text-slate-800">{formatCurrency(item.doanh_thu)}</strong>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </ChartCard>
  )
}
