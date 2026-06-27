import { useState, useEffect } from 'react'
import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import ReviewActionMenu from './ReviewActionMenu'
import ReviewTimeline from './ReviewTimeline'
import { reviewService } from '@/services/review.service'
import type { ReviewItem, ReviewHistoryLog } from '@/types/review.type'

interface Props {
  open: boolean
  review: ReviewItem | null
  onClose: () => void
  onActionSuccess: () => void
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

export default function ReviewDetailModal({ open, review, onClose, onActionSuccess }: Props) {
  const [history, setHistory] = useState<ReviewHistoryLog[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Tải lịch sử thao tác khi modal mở và review được chọn
  useEffect(() => {
    if (open && review?.id) {
      setLoadingLog(true)
      setErrorMsg('')
      setLyDo('')
      reviewService
        .getById(review.id)
        .then((res) => {
          setHistory(res.history)
        })
        .catch((err) => {
          console.error(err)
          setErrorMsg('Không thể tải lịch sử thao tác.')
        })
        .finally(() => {
          setLoadingLog(false)
        })
    }
  }, [open, review])

  if (!open || !review) return null

  const handleAction = async (action: 'hide' | 'show' | 'delete' | 'restore' | 'hard-delete') => {
    setErrorMsg('')
    setSubmitting(true)
    try {
      if (action === 'hard-delete') {
        const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này ra khỏi cơ sở dữ liệu? Thao tác này không thể phục hồi!')
        if (!confirmDelete) {
          setSubmitting(false)
          return
        }
        await reviewService.hardDelete(review.id)
      } else {
        const trimmedLyDo = lyDo.trim()

        if (action === 'hide') {
          await reviewService.hide(review.id, trimmedLyDo)
        } else if (action === 'show') {
          await reviewService.show(review.id, trimmedLyDo)
        } else if (action === 'delete') {
          await reviewService.softDelete(review.id, trimmedLyDo)
        } else if (action === 'restore') {
          await reviewService.restore(review.id, trimmedLyDo)
        }
      }

      onActionSuccess() // Gọi reload lại danh sách từ trang cha
      onClose() // Đóng modal
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Thao tác thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Chi tiết đánh giá & Lịch sử</h2>
            {review.ngay_xoa ? (
              <Badge color="red">🔴 Đã xóa</Badge>
            ) : review.status === 'visible' ? (
              <Badge color="green">🟢 Hiển thị</Badge>
            ) : (
              <Badge color="yellow">🟠 Đã ẩn</Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="overflow-y-auto px-6 py-5 flex-1 space-y-6">
          {/* Thông tin 2 bên: Bệnh nhân & Bác sĩ */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Bệnh nhân */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Người đánh giá
              </span>
              <div className="flex items-center gap-3">
                {review.user?.anh_dai_dien ? (
                  <img
                    src={review.user.anh_dai_dien}
                    alt={review.user.ho_ten}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                    {(review.user?.ho_ten || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-slate-800 leading-tight">
                    {review.user?.ho_ten || 'Không rõ danh tính'}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {review.user?.email || 'Chưa có email'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bác sĩ */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Bác sĩ điều trị
              </span>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                  <Icon name="doctor" className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 leading-tight">
                    {review.doctor?.ho_ten || 'Không rõ bác sĩ'}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {review.doctor?.email || 'Chưa có email'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Điểm & Nội dung đánh giá */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Nội dung đánh giá
              </span>
              <StarDisplay count={review.so_sao} />
            </div>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              {review.noi_dung || <em className="text-slate-400">Người dùng không viết bình luận</em>}
            </p>
          </div>

          {/* Form nhập lý do thay đổi (Ẩn lý do nếu chỉ xóa cứng) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Lý do thực hiện thao tác
            </label>
            <input
              type="text"
              placeholder="Nhập lý do ẩn, hiện, xóa mềm hoặc khôi phục (không bắt buộc)..."
              className="input w-full bg-white text-sm"
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              disabled={submitting}
            />

            {errorMsg && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <Icon name="alert-circle" className="h-3.5 w-3.5" />
                {errorMsg}
              </p>
            )}

            {/* Menu thao tác */}
            <div className="pt-2 border-t border-slate-200/50">
              <ReviewActionMenu
                status={review.status}
                isDeleted={!!review.ngay_xoa}
                onAction={handleAction}
              />
            </div>
          </div>

          {/* Lịch sử thay đổi (Timeline) bên dưới */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2">
              <Icon name="clock" className="h-4 w-4 text-slate-400" />
              Lịch sử thay đổi trạng thái
            </h3>
            <div className="max-h-[300px] overflow-y-auto pr-1">
              <ReviewTimeline history={history} loading={loadingLog} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
