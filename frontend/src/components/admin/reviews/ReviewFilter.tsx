import { useState } from 'react'
import Icon from '@/components/admin/icons'
import type { ReviewFilters } from '@/types/review.type'

// Filter đánh giá

interface Props {
  filters: ReviewFilters
  onChange: (filters: ReviewFilters) => void
  doctors: Array<{ id: string; ho_ten: string }>
}

export default function ReviewFilter({ filters, onChange, doctors }: Props) {
  const [showDateFields, setShowDateFields] = useState(false)

  const handleFilterChange = (key: keyof ReviewFilters, value: any) => {
    onChange({
      ...filters,
      [key]: value,
    })
  }

  const handleClearDates = () => {
    onChange({
      ...filters,
      startDate: '',
      endDate: '',
    })
  }

  // Lấy ngày hiện tại ở múi giờ địa phương (timezone-safe YYYY-MM-DD)
  const getLocalDateString = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const todayStr = getLocalDateString()

  // Kiểm tra lỗi ngày
  let dateError = ''
  if (filters.startDate && filters.startDate > todayStr) {
    dateError = 'Từ ngày không được vượt quá ngày hiện tại'
  } else if (filters.endDate && filters.endDate > todayStr) {
    dateError = 'Đến ngày không được vượt quá ngày hiện tại'
  } else if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    dateError = 'Từ ngày không được lớn hơn Đến ngày'
  }

  return (
    <div className="card mb-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        
        {/* Bộ lọc cơ bản bên trái */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
          {/* Tìm kiếm */}
          <div className="relative w-full sm:w-80">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              className="input pl-9 w-full bg-white text-sm"
              placeholder="Tìm kiếm nội dung, bệnh nhân..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          {/* Lọc số sao */}
          <div className="w-full sm:w-44">
            <select
              className="input w-full bg-white text-sm"
              value={filters.rating}
              onChange={(e) => handleFilterChange('rating', e.target.value)}
            >
              <option value="">Tất cả điểm số</option>
              <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
              <option value="4">⭐⭐⭐⭐ 4 sao</option>
              <option value="3">⭐⭐⭐ 3 sao</option>
              <option value="2">⭐⭐ 2 sao</option>
              <option value="1">⭐ 1 sao</option>
            </select>
          </div>

          {/* Lọc trạng thái hiển thị */}
          <div className="w-full sm:w-44">
            <select
              className="input w-full bg-white text-sm"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">Tất cả hiển thị</option>
              <option value="visible">Đang hiển thị</option>
              <option value="hidden">Đã ẩn</option>
            </select>
          </div>

          {/* Lọc theo bác sĩ */}
          <div className="w-full sm:w-44">
            <select
              className="input w-full bg-white text-sm"
              value={filters.doctor}
              onChange={(e) => handleFilterChange('doctor', e.target.value)}
            >
              <option value="">Tất cả bác sĩ</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.ho_ten}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nút hành động và checkbox bên phải */}
        <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0 border-t pt-3 md:border-t-0 md:pt-0 border-slate-100">
          
          {/* Checkbox Xem đánh giá đã xóa mềm */}
          <div className="flex items-center gap-2">
            <label className="relative flex cursor-pointer items-center rounded-full">
              <input
                type="checkbox"
                className="before:content[''] peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all before:absolute before:left-2/4 before:top-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-gray-500 before:opacity-0 before:transition-opacity checked:border-brand-500 checked:bg-brand-500 checked:before:bg-brand-500 hover:before:opacity-10"
                id="checkbox-deleted"
                checked={filters.deleted}
                onChange={(e) => handleFilterChange('deleted', e.target.checked)}
              />
              <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </label>
            <label
              htmlFor="checkbox-deleted"
              className="text-xs font-semibold text-slate-500 cursor-pointer select-none whitespace-nowrap"
            >
              Xem lại đã xóa
            </label>
          </div>

          {/* Nút Lọc theo ngày (Bấm mở Popover) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDateFields(!showDateFields)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap ${
                showDateFields || filters.startDate || filters.endDate
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon name="calendar" className="h-3.5 w-3.5" />
              <span>Lọc ngày</span>
              {(filters.startDate || filters.endDate) && (
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 ml-0.5" />
              )}
            </button>

            {/* Popover chọn ngày */}
            {showDateFields && (
              <div className="absolute right-0 top-full mt-2 z-30 w-72 p-4 bg-white rounded-xl shadow-xl border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Lọc theo ngày</span>
                  <button
                    type="button"
                    onClick={() => setShowDateFields(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Ngày bắt đầu */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Từ ngày</span>
                  <input
                    type="date"
                    className={`input w-full bg-white text-sm ${filters.startDate && filters.startDate > todayStr ? 'border-red-400 focus:border-red-500 bg-red-50/10' : ''}`}
                    max={todayStr}
                    value={filters.startDate}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>

                {/* Ngày kết thúc */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đến ngày</span>
                  <input
                    type="date"
                    className={`input w-full bg-white text-sm ${
                      (filters.endDate && filters.endDate > todayStr) || (filters.startDate && filters.endDate && filters.startDate > filters.endDate)
                        ? 'border-red-400 focus:border-red-500 bg-red-50/10'
                        : ''
                    }`}
                    max={todayStr}
                    value={filters.endDate}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>

                {/* Footer Popover */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDateFields(false)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors"
                  >
                    Áp dụng
                  </button>
                </div>

                {dateError && (
                  <div className="text-[11px] font-semibold text-red-500 flex items-center gap-1 mt-1 pt-1 border-t border-red-50">
                    <Icon name="alert-circle" className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    <span>{dateError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
