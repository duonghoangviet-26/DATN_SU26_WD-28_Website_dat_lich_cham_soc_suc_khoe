import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import Breadcrumb from '@/components/common/Breadcrumb'
import Empty from '@/components/common/Empty'
import Skeleton from '@/components/common/Skeleton'

export default function ServiceList() {
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setLoading(true)
    serviceService.getAll('related', '', 'active', 1, 100)
      .then((res) => {
        setServices(res.items)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Filter based on Search
  const filteredServices = services.filter((s) => {
    return s.ten.toLowerCase().includes(searchTerm.toLowerCase()) || 
           s.ma_dich_vu.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Dịch vụ điều trị' }]} />

      <div className="text-left space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Gói Dịch Vụ Tai Mũi Họng</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Phòng khám cung cấp đầy đủ các dịch vụ nội soi chẩn đoán và hút rửa xoang mũi lâm sàng bởi các chuyên gia.
        </p>
      </div>

      {/* FILTER SECTION */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-200 pb-4">
        <div /> {/* Spacing */}
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Tìm mã hoặc tên dịch vụ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
          />
        </div>
      </div>

      {/* SERVICES GRID */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4 shadow-sm">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8">
          <Empty title="Không có dịch vụ tương ứng" description="Vui lòng đổi từ khóa hoặc bộ lọc." icon="search" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((s) => (
            <div
              key={s.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-brand-100"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                    {s.ma_dich_vu}
                  </span>
                </div>
                <div className="space-y-1.5 text-left">
                  <h3 className="font-bold text-slate-800 text-base group-hover:text-brand-600 transition-colors">
                    {s.ten}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                    {s.mo_ta_ngan}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  {s.gia.toLocaleString('vi-VN')} đ
                </span>
                <Link
                  to={`/dich-vu/${s.id}`}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  Xem chi tiết
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
