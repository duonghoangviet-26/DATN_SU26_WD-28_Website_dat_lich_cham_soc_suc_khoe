import Icon from '@/components/admin/icons'
import type { ReviewFilters } from '@/types/review.type'

interface Props {
  filters: ReviewFilters
  onChange: (filters: ReviewFilters) => void
  doctors: Array<{ id: string; ho_ten: string }>
}

export default function ReviewFilter({ filters, onChange, doctors }: Props) {
  const handleFilterChange = (key: keyof ReviewFilters, value: any) => {
    onChange({
      ...filters,
      [key]: value,
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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {/* Tìm kiếm từ khóa */}
        <div className="relative md:col-span-2">
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            className="input pl-9 w-full"
            placeholder="Tìm kiếm nội dung, tên bệnh nhân hoặc bác sĩ..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        {/* Lọc số sao */}
        <div>
          <select
            className="input w-full"
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
        <div>
          <select
            className="input w-full"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Tất cả hiển thị</option>
            <option value="visible">Đang hiển thị</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </div>

        {/* Lọc bác sĩ */}
        <div>
          <select
            className="input w-full"
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

        {/* Ngày bắt đầu */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 pl-1">
            Từ ngày
          </span>
          <input
            type="date"
            className={`input w-full ${filters.startDate && filters.startDate > todayStr ? 'border-red-400 focus:border-red-500 bg-red-50/10' : ''}`}
            max={todayStr}
            value={filters.startDate}
            onClick={(e) => e.currentTarget.showPicker?.()}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        {/* Ngày kết thúc */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 pl-1">
            Đến ngày
          </span>
          <input
            type="date"
            className={`input w-full ${
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

        {/* checkbox xem danh sách đã xóa mềm */}
        <div className="flex items-center gap-2 pt-5 pl-2">
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
            className="text-xs font-semibold text-slate-500 cursor-pointer select-none"
          >
            Xem đánh giá đã xóa mềm
          </label>
        </div>

        {dateError && (
          <div className="col-span-full mt-1 text-xs font-semibold text-red-500 flex items-center gap-1.5 pl-1">
            <Icon name="alert-circle" className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
