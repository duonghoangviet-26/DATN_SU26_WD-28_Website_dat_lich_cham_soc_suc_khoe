import Pagination from '@/components/common/Pagination'

interface TablePaginationFooterProps {
  currentPage: number
  totalPages: number
  totalItems: number
  currentItemCount: number
  itemLabel: string
  pageSize?: number
  onPageChange: (page: number) => void
}

export default function TablePaginationFooter({
  currentPage,
  totalPages,
  totalItems,
  currentItemCount,
  itemLabel,
  pageSize = currentItemCount,
  onPageChange,
}: TablePaginationFooterProps) {
  if (totalItems <= 0) return null

  const start = Math.min(totalItems, (currentPage - 1) * pageSize + 1)
  const end = Math.min(totalItems, start + currentItemCount - 1)

  return (
    <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-slate-500">
        Hiển thị <span className="font-semibold text-slate-800">{start}</span> -{' '}
        <span className="font-semibold text-slate-800">{end}</span> trong tổng số{' '}
        <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
      </p>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}
