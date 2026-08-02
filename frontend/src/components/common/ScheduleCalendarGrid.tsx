/* eslint-disable react-refresh/only-export-components -- Shared calendar helpers intentionally live beside the renderer. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { toLocalDateStr } from '@/utils/format'

// ============================================================
// Lưới lịch làm việc dùng chung — Admin (ManageDoctorSchedules) và Bác sĩ (DoctorSchedule).
// Chỉ lo phần TRÌNH BÀY: chuyển tuần/tháng, lưới 7 cột, ô ngày, chú thích màu.
// KHÔNG chứa drawer/hành động — hai trang có nghiệp vụ khác nhau (admin quản trị ngày làm
// việc; bác sĩ xem ca và gửi yêu cầu nghỉ), nên phần đó để mỗi trang tự dựng.
// ============================================================

export type CalendarView = 'week' | 'month'

// Hình dạng tối thiểu để vẽ được 1 ô ngày. Cả AdminDoctorWorkdayItem lẫn ngày tự dựng
// từ DoctorSlot[] bên trang bác sĩ đều thoả.
export interface ScheduleCalendarDay {
  ngay: string
  trang_thai_ngay: 'lam_viec' | 'nghi' | 'nghi_phep' | 'chua_tao'
  tong_slot: number
  slot_da_dat: number
}

interface ScheduleCalendarGridProps<T extends ScheduleCalendarDay> {
  items: T[]
  fromDate: string
  toDate: string
  loading: boolean
  title?: string
  subtitle?: string
  /** Hiện thay cho lưới khi chưa đủ điều kiện hiển thị (vd admin chưa chọn bác sĩ). */
  emptyState?: ReactNode
  selectedDate?: string | null
  onRangeChange: (from: string, to: string) => void
  onSelectDay: (day: T, trigger: HTMLButtonElement) => void
  /** Dấu hiệu phụ ở góc phải ô ngày (admin dùng cho trạng thái xác nhận). */
  renderDayBadge?: (day: T) => ReactNode
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const STATUS_META: Record<ScheduleCalendarDay['trang_thai_ngay'], {
  label: string
  dot: string
  cell: string
  badge: 'green' | 'gray' | 'yellow' | 'red'
}> = {
  lam_viec: {
    label: 'Đi làm',
    dot: 'bg-emerald-600',
    cell: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-50',
    badge: 'green',
  },
  nghi: {
    label: 'Nghỉ',
    dot: 'bg-slate-500',
    cell: 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
    badge: 'gray',
  },
  nghi_phep: {
    label: 'Nghỉ phép',
    dot: 'bg-amber-600',
    cell: 'border-amber-200 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50',
    badge: 'yellow',
  },
  chua_tao: {
    label: 'Chưa tạo lịch',
    dot: 'bg-red-600',
    cell: 'border-dashed border-red-300 bg-red-50/60 hover:border-red-500 hover:bg-red-50',
    badge: 'red',
  },
}

export function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date) {
  return addDays(date, date.getDay() === 0 ? -6 : 1 - date.getDay())
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function getVisibleDays(view: CalendarView, anchor: Date) {
  const start = view === 'week' ? startOfWeek(anchor) : startOfWeek(startOfMonth(anchor))
  return Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => addDays(start, index))
}

function formatRangeLabel(view: CalendarView, anchor: Date) {
  if (view === 'month') {
    return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(anchor)
  }
  const start = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(startOfWeek(anchor))
  const end = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(endOfWeek(anchor))
  return `${start} – ${end}`
}

export function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parseDate(value))
}

export default function ScheduleCalendarGrid<T extends ScheduleCalendarDay>({
  items,
  fromDate,
  toDate,
  loading,
  title = 'Lịch làm việc',
  subtitle = 'Chọn một ngày để xem chi tiết.',
  emptyState,
  selectedDate,
  onRangeChange,
  onSelectDay,
  renderDayBadge,
}: ScheduleCalendarGridProps<T>) {
  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => parseDate(fromDate))
  const [focusedDate, setFocusedDate] = useState(fromDate)
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    setAnchorDate(parseDate(fromDate))
    setFocusedDate(fromDate)
  }, [fromDate])

  const itemByDate = useMemo(() => new Map(items.map((item) => [item.ngay, item])), [items])
  const visibleDays = useMemo(() => getVisibleDays(view, anchorDate), [anchorDate, view])
  const today = toLocalDateStr()

  function applyRange(nextView: CalendarView, nextAnchor: Date) {
    setView(nextView)
    setAnchorDate(nextAnchor)
    const start = nextView === 'week' ? startOfWeek(nextAnchor) : startOfMonth(nextAnchor)
    const end = nextView === 'week' ? endOfWeek(nextAnchor) : endOfMonth(nextAnchor)
    setFocusedDate(toLocalDateStr(start))
    onRangeChange(toLocalDateStr(start), toLocalDateStr(end))
  }

  function moveCalendar(direction: -1 | 1) {
    const next = view === 'week'
      ? addDays(anchorDate, direction * 7)
      : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1)
    applyRange(view, next)
  }

  function moveGridFocus(currentDate: string, event: React.KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let target: Date | null = offsets[event.key] ? addDays(parseDate(currentDate), offsets[event.key]) : null
    if (event.key === 'Home') target = startOfWeek(parseDate(currentDate))
    if (event.key === 'End') target = endOfWeek(parseDate(currentDate))
    if (!target) return
    event.preventDefault()
    const targetKey = toLocalDateStr(target)
    const button = dayButtonRefs.current.get(targetKey)
    if (button && !button.disabled) {
      setFocusedDate(targetKey)
      button.focus()
    }
  }

  const body = emptyState ? (
    <>{emptyState}</>
  ) : loading ? (
    <div className="grid min-h-64 grid-cols-7 gap-px bg-slate-200 p-px" aria-label="Đang tải lịch làm việc" aria-busy="true">
      {Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => (
        <div key={index} className="min-h-28 animate-pulse bg-slate-100 motion-reduce:animate-none" />
      ))}
    </div>
  ) : (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Lịch có thể cuộn ngang trên màn hình nhỏ">
      <p className="px-4 py-2 text-sm text-slate-600 sm:hidden">Vuốt ngang để xem đủ các ngày.</p>
      <div className="min-w-[672px]" role="grid" aria-label={formatRangeLabel(view, anchorDate)}>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50" role="row">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} role="columnheader" className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {visibleDays.map((date) => {
            const dateKey = toLocalDateStr(date)
            const item = itemByDate.get(dateKey)
            const outsideFilter = dateKey < fromDate || dateKey > toDate
            const outsideMonth = view === 'month' && date.getMonth() !== anchorDate.getMonth()
            const status = item ? STATUS_META[item.trang_thai_ngay] : null
            const isToday = dateKey === today

            return (
              <button
                key={dateKey}
                ref={(node) => {
                  if (node) dayButtonRefs.current.set(dateKey, node)
                  else dayButtonRefs.current.delete(dateKey)
                }}
                type="button"
                role="gridcell"
                tabIndex={dateKey === focusedDate ? 0 : -1}
                onFocus={() => setFocusedDate(dateKey)}
                onKeyDown={(event) => moveGridFocus(dateKey, event)}
                onClick={(event) => {
                  if (!item) return
                  onSelectDay(item, event.currentTarget)
                }}
                disabled={!item || outsideFilter}
                className={`relative min-h-32 border p-3 text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 motion-reduce:transition-none ${
                  status?.cell || 'border-slate-100 bg-white'
                } ${isToday ? 'ring-2 ring-inset ring-brand-600' : ''} ${outsideMonth || outsideFilter ? 'opacity-40' : ''} disabled:cursor-default`}
                aria-selected={selectedDate === dateKey}
                aria-label={item ? `${formatFullDate(dateKey)}, ${status?.label}, ${item.slot_da_dat}/${item.tong_slot} lượt khám đã đặt` : formatFullDate(dateKey)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-sm font-bold ${isToday ? 'bg-brand-700 text-white' : 'text-slate-900'}`}>{date.getDate()}</span>
                  {item && renderDayBadge?.(item)}
                </div>
                {item && status && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                      <span className="truncate text-xs font-semibold text-slate-800">{status.label}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-slate-950">{item.slot_da_dat}<span className="text-sm font-medium text-slate-700">/{item.tong_slot}</span></div>
                    <div className="text-xs text-slate-700">lượt khám đã đặt</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <section className="card overflow-hidden" aria-label="Lịch làm việc bác sĩ">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex self-start rounded-lg bg-slate-100 p-1" aria-label="Kiểu hiển thị">
            {(['week', 'month'] as CalendarView[]).map((mode) => (
              <button key={mode} type="button" onClick={() => applyRange(mode, anchorDate)} className={`min-h-11 rounded-md px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 motion-reduce:transition-none ${view === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-700 hover:text-slate-950'}`} aria-pressed={view === mode}>
                {mode === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveCalendar(-1)} className="btn-secondary min-h-11 min-w-11 px-3" aria-label={view === 'week' ? 'Tuần trước' : 'Tháng trước'}><span aria-hidden="true">‹</span></button>
            <div className="min-w-40 flex-1 text-center text-sm font-semibold capitalize text-slate-900 sm:min-w-44">{formatRangeLabel(view, anchorDate)}</div>
            <button type="button" onClick={() => moveCalendar(1)} className="btn-secondary min-h-11 min-w-11 px-3" aria-label={view === 'week' ? 'Tuần sau' : 'Tháng sau'}><span aria-hidden="true">›</span></button>
          </div>
        </div>
      </div>
      {body}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:px-5">
        {(['lam_viec', 'nghi', 'nghi_phep', 'chua_tao'] as const).map((status) => (
          <span key={status} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden="true" />{STATUS_META[status].label}</span>
        ))}
      </div>
    </section>
  )
}
