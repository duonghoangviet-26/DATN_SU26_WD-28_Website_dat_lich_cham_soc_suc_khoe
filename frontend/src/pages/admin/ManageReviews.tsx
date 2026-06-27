import { useEffect, useState } from 'react'
import { reviewService } from '@/services/review.service'
import type { ReviewFilters, ReviewItem, ReviewStatistics, PaginationInfo } from '@/types/review.type'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import ReviewFilter from '@/components/admin/reviews/ReviewFilter'
import ReviewTable from '@/components/admin/reviews/ReviewTable'
import ReviewDetailModal from '@/components/admin/reviews/ReviewDetailModal'

export default function ManageReviews() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  
  // State phân trang & thống kê
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })
  const [statistics, setStatistics] = useState<ReviewStatistics>({
    averageRating: 0,
    total: 0,
    visible: 0,
    hidden: 0,
  })

  // State bộ lọc
  const [filters, setFilters] = useState<ReviewFilters>({
    search: '',
    rating: '',
    status: '',
    doctor: '',
    startDate: '',
    endDate: '',
    deleted: false,
  })

  // Danh sách bác sĩ cho bộ lọc
  const [doctors, setDoctors] = useState<Array<{ id: string; ho_ten: string }>>([])

  // Quản lý Modal chi tiết
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null)
  const [openDetail, setOpenDetail] = useState(false)

  // 1. Tải danh sách bác sĩ làm bộ lọc và tự động cập nhật khi người dùng quay lại tab (window focus)
  useEffect(() => {
    const loadDoctors = () => {
      reviewService
        .getDoctors()
        .then((data) => {
          setDoctors(data)
        })
        .catch((err) => console.error('Lỗi tải danh sách bác sĩ:', err))
    }

    loadDoctors()

    // Khi người dùng click quay lại tab này, tự động làm mới danh sách bác sĩ & dữ liệu trang hiện tại
    const handleFocus = () => {
      loadDoctors()
      fetchReviews(pagination.page)
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [pagination.page])

  // 2. Tải danh sách đánh giá từ API dựa trên bộ lọc và trang hiện tại
  const fetchReviews = (pageNumber = 1) => {
    // Lấy ngày hiện tại ở múi giờ địa phương (timezone-safe YYYY-MM-DD)
    const getLocalDateString = () => {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const todayStr = getLocalDateString()

    // Validate dates before calling API
    const isFutureStart = filters.startDate && filters.startDate > todayStr
    const isFutureEnd = filters.endDate && filters.endDate > todayStr
    const isStartAfterEnd = filters.startDate && filters.endDate && filters.startDate > filters.endDate

    if (isFutureStart || isFutureEnd || isStartAfterEnd) {
      setReviews([])
      setPagination((prev) => ({
        ...prev,
        page: 1,
        total: 0,
        totalPages: 1,
      }))
      setLoading(false)
      return
    }

    setLoading(true)
    reviewService
      .getAll({
        ...filters,
        page: pageNumber,
        limit: pagination.limit,
      })
      .then((res) => {
        setReviews(res.reviews)
        setPagination(res.pagination)
        setStatistics(res.statistics)
      })
      .catch((err) => {
        console.error('Lỗi tải danh sách đánh giá:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // Reload danh sách khi filters hoặc trang thay đổi
  useEffect(() => {
    fetchReviews(1)
  }, [filters])

  const handlePageChange = (newPage: number) => {
    fetchReviews(newPage)
  }

  const handleViewDetail = (review: ReviewItem) => {
    setSelectedReview(review)
    setOpenDetail(true)
  }

  const handleActionSuccess = () => {
    // Làm mới danh sách ở trang hiện tại sau khi thay đổi trạng thái thành công
    fetchReviews(pagination.page)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đánh giá & phản hồi"
        description="Xem và kiểm duyệt các đánh giá từ bệnh nhân, ẩn nội dung không phù hợp hoặc khôi phục/xóa đánh giá."
      />

      {/* Thẻ thống kê tổng quan (Dashboard mini) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Điểm trung bình */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Điểm trung bình</p>
            <p className="text-2xl font-bold text-slate-800">{statistics.averageRating || '0.0'}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Thang điểm 5.0</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500 shadow-sm border border-amber-100/50">
            <Icon name="star" className="h-6 w-6" />
          </div>
        </div>

        {/* Tổng số đánh giá */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Tổng đánh giá hoạt động</p>
            <p className="text-2xl font-bold text-slate-800">{statistics.total}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Từ bệnh nhân</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-sm border border-blue-100/50">
            <Icon name="file-text" className="h-6 w-6" />
          </div>
        </div>

        {/* Số lượng đang hiển thị */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Đang hiển thị</p>
            <p className="text-2xl font-bold text-emerald-600">{statistics.visible}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Công khai trên hệ thống</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 shadow-sm border border-emerald-100/50">
            <Icon name="eye" className="h-6 w-6" />
          </div>
        </div>

        {/* Số lượng bị ẩn */}
        <div className="card p-5 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Đã ẩn kiểm duyệt</p>
            <p className="text-2xl font-bold text-amber-600">{statistics.hidden}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cần xem xét kiểm duyệt</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500 shadow-sm border border-amber-100/50">
            <Icon name="eye-off" className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Bộ lọc component */}
      <ReviewFilter
        filters={filters}
        onChange={setFilters}
        doctors={doctors}
      />

      {/* Bảng danh sách component */}
      <ReviewTable
        reviews={reviews}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onViewDetail={handleViewDetail}
      />

      {/* Modal chi tiết và thao tác */}
      <ReviewDetailModal
        open={openDetail}
        review={selectedReview}
        onClose={() => {
          setOpenDetail(false)
          setSelectedReview(null)
        }}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  )
}
