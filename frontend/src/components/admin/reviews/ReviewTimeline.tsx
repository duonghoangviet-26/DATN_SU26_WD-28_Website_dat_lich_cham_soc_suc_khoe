import Icon from '@/components/admin/icons'
import { formatDate } from '@/utils/format'
import type { ReviewHistoryLog } from '@/types/review.type'

interface Props {
  history: ReviewHistoryLog[]
  loading: boolean
}

// Map mã hành động sang tên tiếng Việt dễ hiểu
const ACTION_LABEL_MAP: Record<string, string> = {
  HIDE_REVIEW: 'Đã ẩn đánh giá',
  RESTORE_REVIEW: 'Đã hiển thị lại / Khôi phục đánh giá',
  DELETE_REVIEW: 'Đã xóa đánh giá',
}

const ACTION_COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
  HIDE_REVIEW: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'eye-off' },
  RESTORE_REVIEW: { bg: 'bg-green-100', text: 'text-green-700', icon: 'eye' },
  DELETE_REVIEW: { bg: 'bg-red-100', text: 'text-red-700', icon: 'trash' },
}

export default function ReviewTimeline({ history, loading }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
        <span className="ml-2 text-sm text-slate-400 font-medium">Đang tải lịch sử thao tác...</span>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <Icon name="clock" className="h-6 w-6 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400 font-semibold">Chưa ghi nhận lịch sử thay đổi nào.</p>
      </div>
    )
  }

  return (
    <div className="relative pl-6 border-l-2 border-slate-100 ml-4 space-y-6 py-2">
      {history.map((log, index) => {
        const style = ACTION_COLOR_MAP[log.hanh_dong] || {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          icon: 'clock',
        }
        const actionLabel = ACTION_LABEL_MAP[log.hanh_dong] || log.hanh_dong

        return (
          <div key={log.id} className="relative group">
            {/* Điểm nút trên timeline */}
            <span className={`absolute -left-[37px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full ${style.bg} ${style.text} ring-4 ring-white shadow-sm`}>
              <Icon name={style.icon as any} className="h-3.5 w-3.5" />
            </span>

            {/* Khối thông tin chi tiết với cỡ chữ lớn hơn thông thường */}
            <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-100 rounded-xl p-4 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className={`text-sm font-bold uppercase tracking-wider ${style.text}`}>
                  {actionLabel}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {formatDate(log.ngay_tao)}
                </span>
              </div>

              {/* Tên & vai trò người thực hiện - Cỡ chữ to (text-base) */}
              <p className="text-base font-semibold text-slate-800 leading-snug">
                Người thực hiện:{' '}
                <span className="text-slate-900 underline decoration-slate-200">
                  {log.nguoi_thuc_hien?.ho_ten || 'Hệ thống'}
                </span>{' '}
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200/60 text-slate-600 ml-1">
                  {log.vai_tro === 'admin' ? 'Quản trị viên' : log.vai_tro}
                </span>
              </p>

              {/* Lý do thay đổi - Cỡ chữ to và rõ ràng (text-base / leading-relaxed) */}
              {log.ly_do && (
                <div className="mt-2.5 bg-white border border-slate-100 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Lý do thay đổi
                  </p>
                  <p className="text-base text-slate-700 font-medium leading-relaxed italic">
                    "{log.ly_do}"
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
