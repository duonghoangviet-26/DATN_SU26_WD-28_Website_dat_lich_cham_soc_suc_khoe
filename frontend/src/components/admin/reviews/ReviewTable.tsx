import { useState } from 'react'
import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import { formatDate } from '@/utils/format'
import { reviewService } from '@/services/review.service'
import type { ReviewItem, PaginationInfo } from '@/types/review.type'


// Bảng danh sách đánh giá

interface Props {
  reviews: ReviewItem[]
  loading: boolean
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  onViewDetail: (review: ReviewItem) => void
}

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          className={`h-4 w-4 ${i <= count ? 'text-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </span>
  )
}

export default function ReviewTable({
  reviews,
  loading,
  pagination,
  onPageChange,
  onViewDetail,
}: Props) {
  const { page, totalPages, total } = pagination
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleDirectAction = async (review: ReviewItem, action: 'hide' | 'show' | 'delete' | 'restore' | 'hard-delete') => {
    const actionNames: Record<string, string> = {
      hide: 'ẩn',
      show: 'hiển thị',
      delete: 'xóa mềm',
      restore: 'khôi phục',
      'hard-delete': 'xóa vĩnh viễn'
    }
    
    let trimmedReason = ''
    if (action === 'hard-delete') {
      const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này ra khỏi cơ sở dữ liệu? Thao tác này không thể phục hồi!')
      if (!confirmDelete) return
    } else if (action === 'show') {
      // Bỏ qua confirm/prompt cho hành động Hiện đánh giá
      trimmedReason = ''
    } else {
      const reason = window.prompt(`Nhập lý do ${actionNames[action]} đánh giá này (không bắt buộc):`, '')
      if (reason === null) return // Hủy bỏ
      trimmedReason = reason.trim()
    }

    try {
      if (action === 'hide') {
        await reviewService.hide(review.id, trimmedReason)
      } else if (action === 'show') {
        await reviewService.show(review.id, trimmedReason)
      } else if (action === 'delete') {
        await reviewService.softDelete(review.id, trimmedReason)
      } else if (action === 'restore') {
        await reviewService.restore(review.id, trimmedReason)
      } else if (action === 'hard-delete') {
        await reviewService.hardDelete(review.id)
      }
      
      alert('Thực hiện thao tác thành công!')
      onPageChange(page) // Tải lại danh sách
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Thao tác thất bại.')
    }
  }

  return (
    <div>
      {/* Bảng đánh giá */}
      <div className="card bg-white rounded-xl shadow-sm border border-slate-100 relative z-10">
        <div className="overflow-x-auto md:overflow-x-visible">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="px-5 py-4">Bệnh nhân</th>
                <th className="px-5 py-4">Bác sĩ</th>
                <th className="px-5 py-4">Điểm</th>
                <th className="px-5 py-4">Nội dung</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      <span>Đang tải danh sách đánh giá...</span>
                    </div>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Không tìm thấy đánh giá nào hợp lệ.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => {
                  const fadeClass = r.ngay_xoa ? 'opacity-60' : r.status === 'hidden' ? 'opacity-75' : ''
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        r.ngay_xoa ? 'bg-red-50/20' : r.status === 'hidden' ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      {/* Bệnh nhân */}
                      <td className={`px-5 py-4 whitespace-nowrap ${fadeClass}`}>
                        <div className="flex items-center gap-3">
                          {r.user?.anh_dai_dien ? (
                            <img
                              src={r.user.anh_dai_dien}
                              alt={r.user.ho_ten}
                              className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-100"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                              {(r.user?.ho_ten || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight">
                              {r.user?.ho_ten || 'Không rõ bệnh nhân'}
                            </p>
                            <p className="text-xs text-slate-400 font-normal">
                              {r.user?.email || 'Chưa có email'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Bác sĩ */}
                      <td className={`px-5 py-4 whitespace-nowrap ${fadeClass}`}>
                        <div className="flex items-center gap-1.5">
                          <Icon name="doctor" className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-700">
                            {r.doctor?.ho_ten || 'Không rõ bác sĩ'}
                          </span>
                        </div>
                      </td>

                      {/* Điểm số */}
                      <td className={`px-5 py-4 whitespace-nowrap ${fadeClass}`}>
                        <StarDisplay count={r.so_sao} />
                      </td>

                      {/* Nội dung */}
                      <td className={`px-5 py-4 max-w-[300px] ${fadeClass}`}>
                        <p
                          className={`text-sm truncate hover:text-clip hover:whitespace-normal font-normal ${
                            r.so_sao <= 2 ? 'text-red-600/90 font-medium' : 'text-slate-600'
                          }`}
                          title={r.noi_dung || ''}
                        >
                          {r.noi_dung || <em className="text-slate-300">Không có nội dung</em>}
                        </p>
                      </td>

                      {/* Ngày tạo */}
                      <td className={`px-5 py-4 whitespace-nowrap text-slate-400 font-normal ${fadeClass}`}>
                        {formatDate(r.ngay_tao)}
                      </td>

                      {/* Trạng thái */}
                      <td className={`px-5 py-4 whitespace-nowrap ${fadeClass}`}>
                        {r.ngay_xoa ? (
                          <Badge color="red">🔴 Đã xóa</Badge>
                        ) : r.status === 'visible' ? (
                          <Badge color="green">🟢 Hiển thị</Badge>
                        ) : (
                          <Badge color="yellow">🟠 Đã ẩn</Badge>
                        )}
                      </td>

                    {/* Thao tác */}
                    <td className={`px-5 py-4 text-right whitespace-nowrap ${openMenuId === r.id ? 'relative z-50' : 'relative'}`}>
                      <div className="inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === r.id ? null : r.id)
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                          title="Thao tác"
                        >
                          <span className="font-bold text-lg leading-none block px-2">⋮</span>
                        </button>
                        
                        {openMenuId === r.id && (
                          <>
                            {/* Backdrop overlay to close menu on click outside */}
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 z-20 w-44 origin-top-right rounded-xl bg-white shadow-lg border border-slate-100 py-1.5 focus:outline-none divide-y divide-slate-100 text-left">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    onViewDetail(r)
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                  <Icon name="eye" className="h-3.5 w-3.5 text-slate-400" />
                                  Xem chi tiết
                                </button>
                              </div>
                              
                              <div className="py-1">
                                {r.ngay_xoa ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleDirectAction(r, 'restore')
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    >
                                      <Icon name="refresh-cw" className="h-3.5 w-3.5 text-emerald-500" />
                                      Khôi phục
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleDirectAction(r, 'hard-delete')
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
                                      Xóa vĩnh viễn
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {r.status === 'visible' ? (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          handleDirectAction(r, 'hide')
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                                      >
                                        <Icon name="eye-off" className="h-3.5 w-3.5 text-amber-500" />
                                        Ẩn đánh giá
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          handleDirectAction(r, 'show')
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                                      >
                                        <Icon name="eye" className="h-3.5 w-3.5 text-emerald-500" />
                                        Hiện đánh giá
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleDirectAction(r, 'delete')
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
                                      Xóa 
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-1">
          <p className="text-sm text-slate-500 font-medium">
            Hiển thị <span className="font-semibold text-slate-800">{reviews.length}</span> / {total} đánh giá
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Trước
            </button>
            <div className="px-3 text-slate-700 font-semibold text-xs">
              Trang {page} / {totalPages}
            </div>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
