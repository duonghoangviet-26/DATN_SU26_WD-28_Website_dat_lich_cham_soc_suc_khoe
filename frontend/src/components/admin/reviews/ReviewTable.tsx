import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import { formatDate } from '@/utils/format'
import type { ReviewItem, PaginationInfo } from '@/types/review.type'

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

  return (
    <div>
      {/* Bảng đánh giá */}
      <div className="card overflow-hidden bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
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
                reviews.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      r.ngay_xoa ? 'bg-red-50/20 opacity-75' : r.status === 'hidden' ? 'bg-slate-50/50 opacity-80' : ''
                    }`}
                  >
                    {/* Bệnh nhân */}
                    <td className="px-5 py-4 whitespace-nowrap">
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
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Icon name="doctor" className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-700">
                          {r.doctor?.ho_ten || 'Không rõ bác sĩ'}
                        </span>
                      </div>
                    </td>

                    {/* Điểm số */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StarDisplay count={r.so_sao} />
                    </td>

                    {/* Nội dung */}
                    <td className="px-5 py-4 max-w-[300px]">
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
                    <td className="px-5 py-4 whitespace-nowrap text-slate-400 font-normal">
                      {formatDate(r.ngay_tao)}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {r.ngay_xoa ? (
                        <Badge color="red">Đã xóa mềm</Badge>
                      ) : r.status === 'visible' ? (
                        <Badge color="green">Hiển thị</Badge>
                      ) : (
                        <Badge color="gray">Đã ẩn</Badge>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onViewDetail(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                        title="Xem chi tiết & quản lý lịch sử"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" />
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
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
