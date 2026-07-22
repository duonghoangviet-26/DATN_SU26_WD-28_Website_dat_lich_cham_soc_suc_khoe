import type { ReactNode } from 'react'

import Icon from '@/components/admin/icons'
import Skeleton from '@/components/common/Skeleton'

interface ChartCardProps {
  title: string
  subtitle: string
  icon: string
  iconClassName: string
  iconBackgroundClassName: string
  loading?: boolean
  empty?: boolean
  error?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export default function ChartCard({
  title,
  subtitle,
  icon,
  iconClassName,
  iconBackgroundClassName,
  loading = false,
  empty = false,
  error = '',
  action,
  children,
  className = '',
}: ChartCardProps) {
  return (
    <section className={`card min-w-0 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBackgroundClassName}`}>
            <Icon name={icon} className={`h-5 w-5 ${iconClassName}`} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{subtitle}</p>
          </div>
        </div>
        {action && <div className="shrink-0 self-start">{action}</div>}
      </div>

      <div className="mt-6 min-w-0">
        {loading ? (
          <div className="space-y-4" aria-label="Đang tải dữ liệu">
            <Skeleton className="h-56 w-full rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center" role="alert">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <Icon name="alert-circle" className="h-5 w-5 text-red-600" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Không tải được dữ liệu</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{error}</p>
          </div>
        ) : empty ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <Icon name="trending" className="h-5 w-5 text-slate-500" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Chưa có dữ liệu</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Chưa phát sinh dữ liệu trong khoảng thời gian đang xem.
            </p>
          </div>
        ) : children}
      </div>
    </section>
  )
}
