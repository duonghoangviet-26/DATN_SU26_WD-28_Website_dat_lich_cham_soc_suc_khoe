import type { ReactNode } from 'react'
import type { BuocQuyTrinh } from '@/utils/dieuPhoiHelpers'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cx('min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-5 lg:px-6', className)}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">{children}</div>
    </div>
  )
}

interface ReceptionistHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  metrics?: ReactNode
}

export function ReceptionistHeader({ eyebrow, title, description, actions, metrics }: ReceptionistHeaderProps) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold text-brand-700">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-950">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {metrics && <div className="mt-4">{metrics}</div>}
    </header>
  )
}

interface PanelProps {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  bodyClassName?: string
}

export function Panel({ children, title, description, action, className, bodyClassName }: PanelProps) {
  const hasHeader = Boolean(title || description || action)

  return (
    <section className={cx('overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-slate-950">{title}</h2>}
            {description && <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cx('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

interface MetricCardProps {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
}

const metricTone = {
  default: 'border-slate-200 bg-white text-slate-950',
  brand: 'border-brand-200 bg-brand-50 text-brand-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
}

export function MetricCard({ label, value, detail, tone = 'default' }: MetricCardProps) {
  return (
    <div className={cx('min-w-0 rounded-lg border px-4 py-3', metricTone[tone])}>
      <p className="text-xs font-semibold leading-5 text-slate-600">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold leading-tight tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{detail}</p>}
    </div>
  )
}

const statusTone = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  brand: 'border-brand-200 bg-brand-50 text-brand-800',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof statusTone
  className?: string
}) {
  return (
    <span className={cx('inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-semibold leading-5', statusTone[tone], className)}>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm leading-6 text-slate-500">
      {children}
    </div>
  )
}

export function LoadingBlock({ children = 'Đang tải dữ liệu...' }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

interface TabItem {
  key: string
  label: string
  badge?: number
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cx(
            'flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition',
            active === item.key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {item.label}
          {Boolean(item.badge) && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function ProcessBar({ steps }: { steps: BuocQuyTrinh[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-start gap-2">
          <span
            className={cx(
              'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
              step.xong ? 'bg-emerald-100 text-emerald-700' : step.dangLam ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400',
            )}
          >
            {step.xong ? '✓' : index + 1}
          </span>
          <div className="min-w-0">
            <p className={cx('text-sm font-bold', step.xong ? 'text-emerald-700' : step.dangLam ? 'text-brand-700' : 'text-slate-400')}>
              {step.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{step.chiTiet}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

