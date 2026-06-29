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

  // Quản lý chọn nhiều đánh giá
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Quản lý Modal chi tiết
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null)
  const [openDetail, setOpenDetail] = useState(false)

  // 1. Tự động cập nhật dữ liệu trang hiện tại khi người dùng quay lại tab (window focus)
  useEffect(() => {
    const handleFocus = () => {
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
    setSelectedIds([]) // Reset chọn nhiều khi đổi bộ lọc
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
    setSelectedIds([]) // Reset chọn nhiều sau khi thao tác
  }

  const handleBatchAction = async (action: 'hide' | 'show' | 'delete' | 'restore' | 'hard-delete') => {
    if (selectedIds.length === 0) return

    const actionNames: Record<string, string> = {
      hide: 'ẩn',
      show: 'hiển thị',
      delete: 'xóa',
      restore: 'khôi phục',
      'hard-delete': 'xóa vĩnh viễn'
    }

    let trimmedReason = ''
    if (action === 'hard-delete') {
      const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.length} đánh giá đã chọn khỏi cơ sở dữ liệu? Thao tác này không thể phục hồi!`)
      if (!confirmDelete) return
    } else if (action === 'show') {
      trimmedReason = ''
    } else {
      const reason = window.prompt(`Nhập lý do ${actionNames[action]} ${selectedIds.length} đánh giá đã chọn (không bắt buộc):`, '')
      if (reason === null) return // Hủy bỏ
      trimmedReason = reason.trim()
    }

    setLoading(true)
    try {
      const res = await reviewService.batchAction({
        ids: selectedIds,
        action,
        ly_do: trimmedReason
      })
      alert(`Đã thực hiện thành công thao tác ${actionNames[action]} cho ${res.count} đánh giá!`)
      setSelectedIds([])
      fetchReviews(pagination.page)
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Thao tác hàng loạt thất bại.')
      setLoading(false)
    }
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
      />

      {/* Thanh tác vụ hàng loạt */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Đã chọn <strong className="text-brand-600">{selectedIds.length}</strong> đánh giá
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline"
            >
              Bỏ chọn tất cả
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filters.deleted ? (
              <>
                <button
                  onClick={() => handleBatchAction('restore')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Icon name="refresh-cw" className="h-3.5 w-3.5" />
                  Khôi phục hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('hard-delete')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Xóa vĩnh viễn hàng loạt
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleBatchAction('show')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Icon name="eye" className="h-3.5 w-3.5" />
                  Hiện hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('hide')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <Icon name="eye-off" className="h-3.5 w-3.5" />
                  Ẩn hàng loạt
                </button>
                <button
                  onClick={() => handleBatchAction('delete')}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-bold text-red-600 shadow-sm hover:bg-red-100/80 transition-colors disabled:opacity-50"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Xóa hàng loạt
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bảng danh sách component */}
      <ReviewTable
        reviews={reviews}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onViewDetail={handleViewDetail}
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
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
