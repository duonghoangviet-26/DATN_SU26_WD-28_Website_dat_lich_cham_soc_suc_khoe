import Icon from '@/components/admin/icons'

interface Props {
  status: 'visible' | 'hidden'
  isDeleted: boolean
  onAction: (action: 'hide' | 'show' | 'delete' | 'restore' | 'hard-delete') => void
}

export default function ReviewActionMenu({ status, isDeleted, onAction }: Props) {
  if (isDeleted) {
    return (
      <div className="flex flex-wrap gap-3">
        {/* Nút Phục hồi */}
        <button
          onClick={() => onAction('restore')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
        >
          <Icon name="refresh-cw" className="h-4 w-4" />
          Khôi phục đánh giá
        </button>

        {/* Nút Xóa cứng */}
        <button
          onClick={() => onAction('hard-delete')}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-all active:scale-95"
        >
          <Icon name="trash" className="h-4 w-4" />
          Xóa vĩnh viễn (Xóa cứng)
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Nút Ẩn / Hiện tùy trạng thái */}
      {status === 'visible' ? (
        <button
          onClick={() => onAction('hide')}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-all active:scale-95"
        >
          <Icon name="eye-off" className="h-4 w-4" />
          Ẩn đánh giá
        </button>
      ) : (
        <button
          onClick={() => onAction('show')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
        >
          <Icon name="eye" className="h-4 w-4" />
          Hiện lại đánh giá
        </button>
      )}

      {/* Nút Xóa mềm luôn hiển thị cho bản ghi chưa xóa */}
      <button
        onClick={() => onAction('delete')}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100/80 transition-all active:scale-95"
      >
        <Icon name="trash" className="h-4 w-4" />
        Xóa mềm đánh giá
      </button>
    </div>
  )
}
