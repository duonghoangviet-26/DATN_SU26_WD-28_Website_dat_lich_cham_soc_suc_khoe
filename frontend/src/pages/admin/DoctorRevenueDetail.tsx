import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { ArrowLeft, RefreshCw, Download, Star } from 'lucide-react'
import * as XLSX from 'xlsx'

import { thongKeService } from '@/services/thong-ke.service'
import type { DoctorRevenueDetail as DoctorRevenueDetailType } from '@/types/thong-ke'
import { clinicDate, clinicMonthStart, clinicYearStart, formatCompactCurrency, formatCurrency, getErrorMessage } from '@/components/admin/dashboard/chart-utils'
import PageHeader from '@/components/common/PageHeader'
import { AdminMotionGroup, AdminMotionItem } from '@/components/admin/motion/AdminMotion'

type Period = 'month' | 'year' | 'all'

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'month', label: '1 tháng' },
  { value: 'year', label: '1 năm' },
  { value: 'all', label: 'Tất cả' },
]

const COLORS = ['#3b82f6', '#f59e0b']

export default function DoctorRevenueDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<DoctorRevenueDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return

    let active = true
    setLoading(true)
    setError('')

    const startDate = period === 'month' ? clinicMonthStart() : (period === 'year' ? clinicYearStart() : '')
    const endDate = period === 'all' ? '' : clinicDate()

    thongKeService.getDoctorRevenueDetail(id, startDate, endDate)
      .then((res) => { if (active) setData(res) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
      
    return () => { active = false }
  }, [id, period])

  if (!id) {
    return <div className="p-8 text-center text-slate-500">Thiếu ID Bác sĩ</div>
  }

  const pieData = data ? [
    { name: 'Bệnh nhân mới', value: data.summary.benh_nhan_moi },
    { name: 'Bệnh nhân cũ', value: data.summary.benh_nhan_cu },
  ] : []

  const handleExportExcel = () => {
    if (!data) return
    
    // 1. Export summary
    const summaryData = [
      {
        'Tổng doanh thu': data.summary.doanh_thu,
        'Tổng bệnh nhân khám': data.summary.tong_benh_nhan,
        'Bệnh nhân mới': data.summary.benh_nhan_moi,
        'Bệnh nhân cũ': data.summary.benh_nhan_cu,
        'Đánh giá trung bình': data.rating.trung_binh,
        'Lượt đánh giá': data.rating.so_luong
      }
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    
    // 2. Export revenue by date
    const wsRevenue = XLSX.utils.json_to_sheet(data.chartData.map(item => ({
      'Ngày': item.ngay,
      'Doanh thu': item.doanh_thu,
      'Số lượt khám': item.so_luot_kham
    })))
    
    // 3. Export top services
    const wsServices = XLSX.utils.json_to_sheet(data.topServices.map(item => ({
      'Tên dịch vụ': item.ten_dich_vu,
      'Số lượt thực hiện': item.so_luot_dung,
      'Doanh thu mang lại': item.doanh_thu
    })))
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan')
    XLSX.utils.book_append_sheet(wb, wsRevenue, 'Doanh thu theo ngày')
    XLSX.utils.book_append_sheet(wb, wsServices, 'Dịch vụ phổ biến')
    
    XLSX.writeFile(wb, `Bao_cao_doanh_thu_bac_si_${id}.xlsx`)
  }

  return (
    <AdminMotionGroup className="space-y-6">
      <AdminMotionItem>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Quay lại"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <PageHeader 
              title="Chi tiết doanh thu bác sĩ" 
              description="Xem chi tiết doanh thu và thống kê bệnh nhân của bác sĩ"
              className="mb-0"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Khoảng thời gian doanh thu">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 motion-reduce:transition-none ${
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
            
            <button
              onClick={handleExportExcel}
              disabled={!data || loading}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Xuất báo cáo</span>
            </button>
          </div>
        </div>
      </AdminMotionItem>

      {error && (
        <AdminMotionItem>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </AdminMotionItem>
      )}

      {loading ? (
        <AdminMotionItem>
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </AdminMotionItem>
      ) : data ? (
        <>
          <AdminMotionItem>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Tổng doanh thu</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(data.summary.doanh_thu)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Tổng bệnh nhân khám</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{data.summary.tong_benh_nhan}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Bệnh nhân mới</div>
                <div className="mt-2 text-2xl font-bold text-blue-600">{data.summary.benh_nhan_moi}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Bệnh nhân cũ (quay lại)</div>
                <div className="mt-2 text-2xl font-bold text-amber-500">{data.summary.benh_nhan_cu}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Đánh giá trung bình</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-slate-900">{data.rating.trung_binh > 0 ? data.rating.trung_binh : '-'}</div>
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </div>
                {data.rating.so_luong > 0 && (
                  <div className="mt-1 text-xs text-slate-500">Dựa trên {data.rating.so_luong} đánh giá</div>
                )}
              </div>
            </div>
          </AdminMotionItem>

          <AdminMotionItem>
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                <h3 className="mb-4 text-base font-semibold text-slate-800">Biểu đồ doanh thu</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="ngay" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={formatCompactCurrency}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Doanh thu']}
                        labelFormatter={(label) => `Ngày: ${label}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="doanh_thu" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-slate-800">Tỷ lệ bệnh nhân</h3>
                <div className="h-64 w-full">
                  {data.summary.tong_benh_nhan > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [value, 'Số lượng']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Chưa có dữ liệu bệnh nhân
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AdminMotionItem>

          <AdminMotionItem>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-800">Dịch vụ thực hiện phổ biến</h3>
              {data.topServices && data.topServices.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="px-4 py-3">Tên dịch vụ</th>
                        <th className="px-4 py-3 text-right">Số lượt thực hiện</th>
                        <th className="px-4 py-3 text-right">Doanh thu mang lại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.topServices.map((service, index) => (
                        <tr key={index} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{service.ten_dich_vu}</td>
                          <td className="px-4 py-3 text-right">{service.so_luot_dung}</td>
                          <td className="px-4 py-3 text-right font-medium text-brand-600">
                            {formatCurrency(service.doanh_thu)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                  Chưa có dữ liệu dịch vụ trong khoảng thời gian này
                </div>
              )}
            </div>
          </AdminMotionItem>
        </>
      ) : null}
    </AdminMotionGroup>
  )
}
