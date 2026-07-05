import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { mockDoctors } from '@/mock/doctors'
import Breadcrumb from '@/components/common/Breadcrumb'
import Empty from '@/components/common/Empty'
import Skeleton from '@/components/common/Skeleton'
import type { DoctorProfile } from '@/types'

export default function DoctorList() {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_300k' | 'above_300k'>('all')
  const [expFilter, setExpFilter] = useState<'all' | 'under_15_years' | 'above_15_years'>('all')
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])

  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setDoctors(mockDoctors.filter((d) => d.loai === 'specialist' && d.trang_thai_duyet === 'approved'))
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  // Filtering logic
  const filteredDoctors = doctors.filter((d) => {
    const matchesSearch = d.ho_ten.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesPrice = true
    if (priceFilter === 'under_300k') matchesPrice = d.gia_kham < 300000
    else if (priceFilter === 'above_300k') matchesPrice = d.gia_kham >= 300000

    let matchesExp = true
    if (expFilter === 'under_15_years') matchesExp = d.so_nam_kinh_nghiem < 15
    else if (expFilter === 'above_15_years') matchesExp = d.so_nam_kinh_nghiem >= 15

    return matchesSearch && matchesPrice && matchesExp
  })

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Bác sĩ Tai Mũi Họng' }]} />

      <div className="text-left space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Đội Ngũ Bác Sĩ Chuyên Khoa</h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Các phó giáo sư, tiến sĩ và thạc sĩ y học chuyên khoa Tai Mũi Họng trực tiếp chẩn đoán và điều trị tại VitaFamily.
        </p>
      </div>

      {/* FILTER BAR */}
      <div className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên bác sĩ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition"
          />
        </div>

        {/* Price Filter */}
        <div>
          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
          >
            <option value="all">Tất cả phí khám</option>
            <option value="under_300k">Dưới 300.000đ / lượt</option>
            <option value="above_300k">Từ 300.000đ trở lên</option>
          </select>
        </div>

        {/* Experience Filter */}
        <div>
          <select
            value={expFilter}
            onChange={(e) => setExpFilter(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
          >
            <option value="all">Tất cả kinh nghiệm</option>
            <option value="under_15_years">Dưới 15 năm kinh nghiệm</option>
            <option value="above_15_years">Trên 15 năm kinh nghiệm</option>
          </select>
        </div>
      </div>

      {/* DOCTORS GRID */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8">
          <Empty title="Không tìm thấy bác sĩ nào" description="Bạn vui lòng thay đổi từ khóa tìm kiếm hoặc mức lọc thích hợp." icon="search" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredDoctors.map((d) => (
            <div key={d.id} className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300">
              <div>
                <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                  {d.anh_dai_dien ? (
                    <img src={d.anh_dai_dien} alt={d.ho_ten} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-brand-55 text-brand-600 font-extrabold text-3xl">
                      {d.ho_ten.split(' ').pop()?.charAt(0)}
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2 py-0.5 text-xs font-bold text-slate-800 shadow-sm">
                    ⭐ {d.diem_danh_gia.toFixed(1)}
                  </span>
                </div>

                <div className="p-4 space-y-2 text-left">
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">
                    {d.ho_ten}
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {d.bang_cap.split('chuyên ngành')[0] || d.bang_cap}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {d.kinh_nghiem}
                  </p>
                </div>
              </div>

              <div className="p-4 pt-0 border-t border-slate-50 flex items-center justify-between mt-2">
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Phí khám</p>
                  <p className="text-sm font-extrabold text-slate-900">{d.gia_kham.toLocaleString('vi-VN')}đ</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/bac-si/${d.id}`} className="btn-secondary px-2.5 py-1.5 text-xs font-bold">
                    Chi tiết
                  </Link>
                  <Link to={`/booking?doctor_id=${d.id}`} className="btn-primary px-3 py-1.5 text-xs font-bold shadow-sm shadow-brand-100">
                    Đặt lịch
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
