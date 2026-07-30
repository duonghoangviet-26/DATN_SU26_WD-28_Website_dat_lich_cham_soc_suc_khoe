import { useEffect, useMemo, useRef, useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import type { AdminDoctorWorkdayItem } from '@/types'
import { toLocalDateStr } from '@/utils/format'

// Lưới lịch (chuyển tuần/tháng, ô ngày, chú thích) nằm ở ScheduleCalendarGrid — dùng chung
// với trang Lịch làm việc của bác sĩ. File này chỉ còn phần drawer quản trị của Admin.

type WorkdayStatus = 'lam_viec' | 'nghi' | 'nghi_phep'
type CalendarView = 'week' | 'month'

interface DoctorScheduleCalendarProps {
  items: AdminDoctorWorkdayItem[]
  fromDate: string
  toDate: string
  doctorSelected: boolean
  loading: boolean
  savingId: string | null
  error: string | null
  onRangeChange: (from: string, to: string) => void
  onOpenScheduleEditor: (scheduleId: string) => Promise<void>
  onOpenHistory: (item: AdminDoctorWorkdayItem) => Promise<void>
  onUpdateWorkday: (item: AdminDoctorWorkdayItem, status: WorkdayStatus) => Promise<void>
  onCreateScheduleForDay: (item: AdminDoctorWorkdayItem) => Promise<void>
  onViewBookedAppointments?: (item: AdminDoctorWorkdayItem) => void
  onRetry?: () => void
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const STATUS_META: Record<AdminDoctorWorkdayItem['trang_thai_ngay'], {
  label: string
  shortLabel: string
  dot: string
  accent: string
  badge: 'green' | 'gray' | 'yellow' | 'red'
  surface: string
}> = {
  lam_viec: {
    label: 'Đi làm',
    shortLabel: 'Làm việc',
    dot: 'bg-emerald-500',
    accent: 'bg-emerald-500',
    badge: 'green',
    surface: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  nghi: {
    label: 'Nghỉ làm',
    shortLabel: 'Nghỉ',
    dot: 'bg-slate-500',
    accent: 'bg-slate-400',
    badge: 'gray',
    surface: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  nghi_phep: {
    label: 'Nghỉ phép',
    shortLabel: 'Nghỉ phép',
    dot: 'bg-amber-500',
    accent: 'bg-amber-500',
    badge: 'yellow',
    surface: 'bg-amber-50 text-amber-800 ring-amber-100',
  },
  chua_tao: {
    label: 'Chưa tạo lịch',
    shortLabel: 'Chưa tạo',
    dot: 'bg-rose-500',
    accent: 'bg-rose-400',
    badge: 'red',
    surface: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
}

const CONFIRMATION_META: Record<AdminDoctorWorkdayItem['trang_thai_xac_nhan'], {
  label: string
  symbol: string
  className: string
  badge: 'green' | 'yellow' | 'red'
}> = {
  cho_xac_nhan: {
    label: 'Chờ xác nhận',
    symbol: '',
    className: 'h-2.5 w-2.5 bg-amber-500',
    badge: 'yellow',
  },
  da_xac_nhan: {
    label: 'Đã xác nhận',
    symbol: '✓',
    className: 'h-5 w-5 bg-emerald-600 text-[11px] font-bold text-white',
    badge: 'green',
  },
  tu_choi: {
    label: 'Cảnh báo xác nhận',
    symbol: '!',
    className: 'h-5 w-5 bg-rose-600 text-xs font-bold text-white',
    badge: 'red',
  },
}

const CAPACITY_META = {
  normal: {
    label: 'Bình thường',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    surface: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  busy: {
    label: 'Gần đầy',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    surface: 'bg-amber-50 text-amber-800 ring-amber-100',
  },
  almostFull: {
    label: 'Sắp đầy',
    bar: 'bg-orange-500',
    text: 'text-orange-700',
    surface: 'bg-orange-50 text-orange-800 ring-orange-100',
  },
  full: {
    label: 'Đầy lịch',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    surface: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  overloaded: {
    label: 'Quá tải',
    bar: 'bg-red-600',
    text: 'text-red-700',
    surface: 'bg-red-50 text-red-700 ring-red-100',
  },
  none: {
    label: 'Chưa có sức chứa',
    bar: 'bg-slate-300',
    text: 'text-slate-500',
    surface: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
}

function parseDate(value: string) {
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

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parseDate(value))
}

function getCapacityRate(item: Pick<AdminDoctorWorkdayItem, 'slot_da_dat' | 'tong_slot'>) {
  if (item.tong_slot <= 0) return 0
  return Math.round((item.slot_da_dat / item.tong_slot) * 100)
}

function getCapacityTone(item: Pick<AdminDoctorWorkdayItem, 'slot_da_dat' | 'tong_slot'>) {
  if (item.tong_slot <= 0) return CAPACITY_META.none
  const rate = getCapacityRate(item)
  if (item.slot_da_dat > item.tong_slot) return CAPACITY_META.overloaded
  if (rate >= 100) return CAPACITY_META.full
  if (rate >= 85) return CAPACITY_META.almostFull
  if (rate >= 60) return CAPACITY_META.busy
  return CAPACITY_META.normal
}

function getCapacityLabel(item: Pick<AdminDoctorWorkdayItem, 'slot_da_dat' | 'tong_slot'>) {
  if (item.tong_slot <= 0) return 'Chưa có sức chứa'
  const rate = getCapacityRate(item)
  if (item.slot_da_dat > item.tong_slot) return `${rate}% quá tải`
  return `${rate}% công suất`
}

function CapacityProgress({ item, compact = false }: { item: AdminDoctorWorkdayItem; compact?: boolean }) {
  const tone = getCapacityTone(item)
  const rate = getCapacityRate(item)
  const width = item.tong_slot <= 0 ? 0 : Math.min(rate, 100)

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
        <span className={tone.text}>{tone.label}</span>
        <span className="text-slate-500">{getCapacityLabel(item)}</span>
      </div>
    </div>
  )
}

function ScheduleStatusBadge({ item }: { item: AdminDoctorWorkdayItem }) {
  const status = STATUS_META[item.trang_thai_ngay]
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ${status.surface}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
      <span className="truncate">{status.shortLabel}</span>
    </span>
  )
}

function ScheduleSummaryCards({ items, loading }: { items: AdminDoctorWorkdayItem[]; loading: boolean }) {
  const summary = useMemo(() => {
    const workingDays = items.filter((item) => item.trang_thai_ngay === 'lam_viec').length
    const booked = items.reduce((total, item) => total + item.slot_da_dat, 0)
    const capacity = items.reduce((total, item) => total + item.tong_slot, 0)
    const missing = items.filter((item) => item.trang_thai_ngay === 'chua_tao').length
    const utilization = capacity > 0 ? Math.round((booked / capacity) * 100) : 0

    return { workingDays, booked, capacity, missing, utilization }
  }, [items])

  const cards = [
    { label: 'Ngày làm việc', value: `${summary.workingDays}`, suffix: 'ngày', icon: 'calendar', hint: 'trong khoảng đang xem' },
    { label: 'Đã đặt', value: `${summary.booked}`, suffix: 'lượt', icon: 'check', hint: 'lịch hẹn đã giữ chỗ' },
    { label: 'Tổng sức chứa', value: `${summary.capacity}`, suffix: 'lượt', icon: 'users', hint: 'tổng slot có thể nhận' },
    { label: 'Chưa tạo lịch', value: `${summary.missing}`, suffix: 'ngày', icon: 'alert-circle', hint: 'cần chạy bù nếu thiếu' },
    { label: 'Công suất', value: `${summary.utilization}`, suffix: '%', icon: 'trending', hint: summary.capacity > 0 ? 'đã đặt / sức chứa' : 'chưa có sức chứa' },
  ]

  return (
    <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:px-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-100/70">
          {loading ? (
            <div className="animate-pulse space-y-3 motion-reduce:animate-none">
              <div className="h-8 w-8 rounded-lg bg-slate-100" />
              <div className="h-6 w-20 rounded bg-slate-100" />
              <div className="h-3 w-28 rounded bg-slate-100" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon name={card.icon} className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-2xl font-bold leading-none text-slate-950 tabular-nums">{card.value}</span>
                <span className="text-xs font-semibold text-slate-500">{card.suffix}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function ScheduleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-600 sm:px-5">
      {(['lam_viec', 'chua_tao', 'nghi', 'nghi_phep'] as const).map((status) => (
        <span key={status} className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden="true" />
          {STATUS_META[status].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <span className={`h-2.5 w-6 rounded-full ${CAPACITY_META.full.bar}`} aria-hidden="true" />
        Đầy lịch
      </span>
      <span className="inline-flex items-center gap-2">
        <span className={`h-2.5 w-6 rounded-full ${CAPACITY_META.overloaded.bar}`} aria-hidden="true" />
        Quá tải
      </span>
    </div>
  )
}

function CalendarEmptyState({
  doctorSelected,
  error,
  onRetry,
}: {
  doctorSelected: boolean
  error: string | null
  onRetry?: () => void
}) {
  if (!doctorSelected) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-5 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <Icon name="doctor" className="h-5 w-5 text-slate-600" />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-900">Chưa chọn bác sĩ</p>
        <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">Chọn bác sĩ ở bộ lọc để xem lịch làm việc và sức chứa theo ngày.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-5 text-center" role="alert">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <Icon name="alert-circle" className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-900">Không tải được lịch làm việc</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">Dữ liệu lịch chưa sẵn sàng. Vui lòng thử tải lại sau.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary mt-4 min-h-11">
            <Icon name="refresh-cw" className="h-4 w-4" />
            Thử lại
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-5 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <Icon name="calendar" className="h-5 w-5 text-slate-600" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">Khoảng thời gian này chưa có lịch</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">Nếu đây là dữ liệu thiếu, hãy chọn ngày trong lịch sau khi hệ thống trả về bản ghi hoặc chạy bù từ chi tiết ngày chưa tạo.</p>
    </div>
  )
}

function CalendarSkeleton({ view }: { view: CalendarView }) {
  return (
    <div className="overflow-x-auto" aria-label="Đang tải lịch làm việc" aria-busy="true">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-3 text-center text-xs font-semibold text-slate-500">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-slate-100">
          {Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => (
            <div key={index} className="m-px min-h-[164px] animate-pulse bg-white p-3 motion-reduce:animate-none">
              <div className="h-7 w-7 rounded-lg bg-slate-100" />
              <div className="mt-5 h-4 w-24 rounded bg-slate-100" />
              <div className="mt-8 h-6 w-20 rounded bg-slate-100" />
              <div className="mt-3 h-2 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CalendarDayCell({
  date,
  dateKey,
  item,
  view,
  anchorDate,
  selectedDate,
  focusedDate,
  today,
  disabled,
  onFocus,
  onKeyDown,
  onClick,
  setRef,
}: {
  date: Date
  dateKey: string
  item?: AdminDoctorWorkdayItem
  view: CalendarView
  anchorDate: Date
  selectedDate?: string
  focusedDate: string
  today: string
  disabled: boolean
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  setRef: (node: HTMLButtonElement | null) => void
}) {
  const outsideMonth = view === 'month' && date.getMonth() !== anchorDate.getMonth()
  const isToday = dateKey === today
  const isSelected = selectedDate === dateKey
  const status = item ? STATUS_META[item.trang_thai_ngay] : null
  const confirmation = item ? CONFIRMATION_META[item.trang_thai_xac_nhan] : null
  const capacityTone = item ? getCapacityTone(item) : null
  const showWarning = item ? item.slot_da_dat > item.tong_slot && item.tong_slot > 0 : false
  const hasLockedSlots = item ? item.slot_bi_khoa > 0 : false

  return (
    <button
      ref={setRef}
      type="button"
      role="gridcell"
      tabIndex={dateKey === focusedDate ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onClick}
      disabled={disabled}
      className={`group relative m-px flex min-h-[164px] flex-col overflow-hidden bg-white p-3 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 motion-reduce:transition-none ${disabled ? 'cursor-default' : 'cursor-pointer hover:z-10 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70'
        } ${outsideMonth ? 'bg-slate-50/80 text-slate-400' : ''} ${isSelected ? 'z-20 bg-brand-50/50 ring-2 ring-inset ring-brand-500 shadow-md shadow-brand-100' : ''} ${isToday && !isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}
      aria-selected={isSelected}
      aria-label={item ? `${formatFullDate(dateKey)}, ${status?.label}, ${item.slot_da_dat}/${item.tong_slot} lượt đã đặt` : formatFullDate(dateKey)}
    >
      {status && <span className={`absolute inset-x-0 top-0 h-1 ${status.accent}`} aria-hidden="true" />}
      <div className="flex items-start justify-between gap-2 pt-1">
        <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1 text-sm font-bold tabular-nums ${isToday ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' : outsideMonth ? 'text-slate-400' : 'text-slate-950'
          }`}>
          {date.getDate()}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {confirmation && (
            <span title={confirmation.label} className={`flex items-center justify-center rounded-full ${confirmation.className}`} aria-label={confirmation.label}>
              {confirmation.symbol}
            </span>
          )}
          {hasLockedSlots && (
            <span title="Có slot bị khóa" className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">
              <Icon name="lock" className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {item && status ? (
        <>
          <div className="mt-4 space-y-2">
            <ScheduleStatusBadge item={item} />
            <p className="min-h-5 truncate text-xs font-medium text-slate-500">
              {item.gio_bat_dau && item.gio_ket_thuc ? `${item.gio_bat_dau} – ${item.gio_ket_thuc}` : 'Chưa có khung giờ'}
            </p>
          </div>

          <div className="mt-auto space-y-2.5 pt-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xl font-bold leading-none text-slate-950 tabular-nums">
                  {item.slot_da_dat}
                  <span className="text-sm font-semibold text-slate-500">/{item.tong_slot}</span>
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">lượt đã đặt</p>
              </div>
              {capacityTone && (
                <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ${capacityTone.surface}`}>
                  {showWarning ? 'Quá tải' : capacityTone.label}
                </span>
              )}
            </div>
            <CapacityProgress item={item} compact />
          </div>
        </>
      ) : (
        <div className="mt-auto text-xs text-slate-400">Không có dữ liệu</div>
      )}
    </button>
  )
}

export default function DoctorScheduleCalendar({
  items,
  fromDate,
  toDate,
  doctorSelected,
  loading,
  savingId,
  error,
  onRangeChange,
  onOpenScheduleEditor,
  onOpenHistory,
  onUpdateWorkday,
  onCreateScheduleForDay,
  onViewBookedAppointments,
  onRetry,
}: DoctorScheduleCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<AdminDoctorWorkdayItem | null>(null)
  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => parseDate(fromDate))
  const [focusedDate, setFocusedDate] = useState(fromDate)
  const drawerRef = useRef<HTMLElement | null>(null)
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    setAnchorDate(parseDate(fromDate))
    setFocusedDate(fromDate)
  }, [fromDate])

  useEffect(() => {
    if (!selectedDay) return
    const updated = items.find((item) => item.ngay === selectedDay.ngay)
    if (updated) setSelectedDay(updated)
    else setSelectedDay(null)
  }, [items, selectedDay])

  function closeDrawer() {
    setSelectedDay(null)
    window.setTimeout(() => drawerTriggerRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!selectedDay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const drawer = drawerRef.current
    drawer?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDay])

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

  const calendarBody = !doctorSelected || error ? (
    <CalendarEmptyState doctorSelected={doctorSelected} error={error} onRetry={onRetry} />
  ) : loading ? (
    <CalendarSkeleton view={view} />
  ) : items.length === 0 ? (
    <CalendarEmptyState doctorSelected={doctorSelected} error={null} />
  ) : (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Lịch có thể cuộn ngang trên màn hình nhỏ">
      <p className="px-4 py-2 text-xs font-medium text-slate-500 sm:hidden">Vuốt ngang để xem đủ các ngày.</p>
      <div className="min-w-[760px]" role="grid" aria-label={formatRangeLabel(view, anchorDate)}>
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50" role="row">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} role="columnheader" className="px-3 py-3 text-center text-xs font-semibold text-slate-600">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-slate-100">
          {visibleDays.map((date) => {
            const dateKey = toLocalDateStr(date)
            const item = itemByDate.get(dateKey)
            const outsideFilter = dateKey < fromDate || dateKey > toDate

            return (
              <CalendarDayCell
                key={dateKey}
                date={date}
                dateKey={dateKey}
                item={item}
                view={view}
                anchorDate={anchorDate}
                selectedDate={selectedDay?.ngay}
                focusedDate={focusedDate}
                today={today}
                disabled={!item || outsideFilter}
                onFocus={() => setFocusedDate(dateKey)}
                onKeyDown={(event) => moveGridFocus(dateKey, event)}
                onClick={(event) => {
                  if (!item) return
                  drawerTriggerRef.current = event.currentTarget
                  setSelectedDay(item)
                }}
                setRef={(node) => {
                  if (node) dayButtonRefs.current.set(dateKey, node)
                  else dayButtonRefs.current.delete(dateKey)
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )

  const selectedCapacityTone = selectedDay ? getCapacityTone(selectedDay) : null

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70" aria-label="Lịch làm việc bác sĩ">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Lịch làm việc</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Theo dõi lịch làm việc, sức chứa và số lượt khám theo từng ngày.</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => applyRange(view, new Date())} className="btn-secondary min-h-11" title="Quay về hôm nay">
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => moveCalendar(-1)}
                className="btn-secondary min-h-11 min-w-11 px-3"
                aria-label={view === 'week' ? 'Tuần trước' : 'Tháng trước'}
                title={view === 'week' ? 'Tuần trước' : 'Tháng trước'}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <div className="min-h-11 min-w-44 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold capitalize text-slate-900 tabular-nums">
                {formatRangeLabel(view, anchorDate)}
              </div>
              <button
                type="button"
                onClick={() => moveCalendar(1)}
                className="btn-secondary min-h-11 min-w-11 px-3"
                aria-label={view === 'week' ? 'Tuần sau' : 'Tháng sau'}
                title={view === 'week' ? 'Tuần sau' : 'Tháng sau'}
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200" aria-label="Kiểu hiển thị">
              {(['week', 'month'] as CalendarView[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyRange(mode, anchorDate)}
                  className={`min-h-10 rounded-md px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-300 motion-reduce:transition-none ${view === mode ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                    }`}
                  aria-pressed={view === mode}
                >
                  {mode === 'week' ? 'Tuần' : 'Tháng'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ScheduleSummaryCards items={items} loading={loading} />
        <ScheduleLegend />
        {calendarBody}
      </section>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDrawer() }}>
          <aside ref={drawerRef} className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-lg" role="dialog" aria-modal="true" aria-labelledby="schedule-day-title" aria-describedby="schedule-day-summary">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">Chi tiết ngày</p>
                  <h2 id="schedule-day-title" className="mt-1 text-lg font-bold capitalize text-slate-950">{formatFullDate(selectedDay.ngay)}</h2>
                </div>
                <button type="button" onClick={closeDrawer} className="btn-icon min-h-11 min-w-11" aria-label="Đóng chi tiết ngày">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge color={STATUS_META[selectedDay.trang_thai_ngay].badge}>{STATUS_META[selectedDay.trang_thai_ngay].label}</Badge>
                <Badge color={CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].badge}>{CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].label}</Badge>
                {selectedCapacityTone && selectedDay.tong_slot > 0 && <Badge color={selectedDay.slot_da_dat >= selectedDay.tong_slot ? 'red' : 'blue'}>{selectedCapacityTone.label}</Badge>}
                {selectedDay.canh_bao_xung_dot_xac_nhan && <Badge color="red">Có lịch cần xử lý</Badge>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              <div id="schedule-day-summary" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Ca làm việc</p>
                <p className="mt-1 text-base font-bold text-slate-950">
                  {selectedDay.gio_bat_dau && selectedDay.gio_ket_thuc ? `${selectedDay.gio_bat_dau} – ${selectedDay.gio_ket_thuc}` : 'Chưa có khung giờ làm việc'}
                </p>
                {selectedDay.ghi_chu_ngay && <p className="mt-2 break-words text-sm leading-6 text-slate-700">{selectedDay.ghi_chu_ngay}</p>}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Công suất đặt lịch</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950 tabular-nums">
                      {selectedDay.slot_da_dat}
                      <span className="text-base font-semibold text-slate-500">/{selectedDay.tong_slot}</span>
                    </p>
                  </div>
                  {selectedCapacityTone && (
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${selectedCapacityTone.surface}`}>
                      {selectedCapacityTone.label}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <CapacityProgress item={selectedDay} />
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200">
                {[
                  { label: 'Tổng slot', value: selectedDay.tong_slot },
                  { label: 'Slot còn lại', value: Math.max(selectedDay.slot_trong, 0) },
                  {
                    label: 'Đã đặt',
                    value: selectedDay.slot_da_dat,
                    action: selectedDay.slot_da_dat > 0 && onViewBookedAppointments
                      ? (
                        <button
                          type="button"
                          onClick={() => onViewBookedAppointments(selectedDay)}
                          className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <Icon name="eye" className="h-3.5 w-3.5" />
                          Xem lịch
                        </button>
                      )
                      : null,
                  },
                  { label: 'Bị khóa / hủy', value: selectedDay.slot_bi_khoa + selectedDay.slot_da_huy },
                  { label: 'Online còn trống', value: selectedDay.slot_online_trong },
                  { label: 'Tại chỗ còn trống', value: selectedDay.slot_walkin_trong },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 bg-white p-4">
                    <dt className="text-sm text-slate-600">{item.label}</dt>
                    <dd className="mt-1 break-words text-base font-bold text-slate-950 tabular-nums">{item.value}</dd>
                    {item.action}
                  </div>
                ))}
              </dl>

              {selectedDay.canh_bao_xung_dot_xac_nhan && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  Bác sĩ đã từ chối ngày làm việc nhưng vẫn còn {selectedDay.so_lich_hen_xung_dot} lịch hẹn cần xử lý.
                </div>
              )}
              {selectedDay.ly_do_tu_choi_xac_nhan && <p className="mt-4 break-words text-sm text-red-800">Lý do từ chối: {selectedDay.ly_do_tu_choi_xac_nhan}</p>}
              {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
            </div>

            <div className="border-t border-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              {!selectedDay._id ? (
                <button type="button" onClick={() => onCreateScheduleForDay(selectedDay)} disabled={savingId === selectedDay.ngay || selectedDay.trang_thai_ngay === 'nghi'} className="btn-primary min-h-11 w-full disabled:opacity-50">
                  {savingId === selectedDay.ngay ? 'Đang chạy bù...' : 'Chạy bù lịch cho ngày này'}
                </button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => onOpenScheduleEditor(selectedDay._id!)} className="btn-primary min-h-11">Chỉnh khung giờ</button>
                  <button type="button" onClick={() => onOpenHistory(selectedDay)} className="btn-secondary min-h-11"><Icon name="clock" className="h-4 w-4" /> Lịch sử</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'lam_viec')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'lam_viec'} className="min-h-11 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">Đánh dấu đi làm</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'nghi')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'nghi' || selectedDay.slot_da_dat > 0} title={selectedDay.slot_da_dat > 0 ? 'Không thể đánh dấu nghỉ khi còn lịch hẹn' : undefined} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Đánh dấu nghỉ</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'nghi_phep')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'nghi_phep' || selectedDay.slot_da_dat > 0} title={selectedDay.slot_da_dat > 0 ? 'Không thể đánh dấu nghỉ phép khi còn lịch hẹn' : undefined} className="min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">Đánh dấu nghỉ phép</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
