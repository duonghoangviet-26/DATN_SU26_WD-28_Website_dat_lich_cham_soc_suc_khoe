import { useEffect, useMemo, useRef, useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import type { AdminDoctorWorkdayItem } from '@/types'
import { toLocalDateStr } from '@/utils/format'

type CalendarView = 'week' | 'month'
type WorkdayStatus = 'lam_viec' | 'nghi' | 'nghi_phep'

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
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const STATUS_META: Record<AdminDoctorWorkdayItem['trang_thai_ngay'], {
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

const CONFIRMATION_META: Record<AdminDoctorWorkdayItem['trang_thai_xac_nhan'], {
  label: string
  symbol: string
  className: string
  badge: 'green' | 'yellow' | 'red'
}> = {
  cho_xac_nhan: {
    label: 'Chờ xác nhận',
    symbol: '',
    className: 'h-3 w-3 bg-amber-500',
    badge: 'yellow',
  },
  da_xac_nhan: {
    label: 'Đã xác nhận',
    symbol: '✓',
    className: 'h-5 w-5 bg-emerald-700 text-[11px] font-bold text-white',
    badge: 'green',
  },
  tu_choi: {
    label: 'Cảnh báo xác nhận',
    symbol: '!',
    className: 'h-5 w-5 bg-red-700 text-xs font-bold text-white',
    badge: 'red',
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
}: DoctorScheduleCalendarProps) {
  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => parseDate(fromDate))
  const [selectedDay, setSelectedDay] = useState<AdminDoctorWorkdayItem | null>(null)
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

  const calendarBody = !doctorSelected ? (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <Icon name="doctor" className="h-5 w-5 text-slate-600" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">Chưa chọn bác sĩ</p>
      <p className="mt-1 text-sm text-slate-600">Chọn bác sĩ ở bộ lọc để xem lịch làm việc.</p>
    </div>
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
            const confirmation = item ? CONFIRMATION_META[item.trang_thai_xac_nhan] : null
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
                  drawerTriggerRef.current = event.currentTarget
                  setSelectedDay(item)
                }}
                disabled={!item || outsideFilter}
                className={`relative min-h-32 border p-3 text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 motion-reduce:transition-none ${
                  status?.cell || 'border-slate-100 bg-white'
                } ${isToday ? 'ring-2 ring-inset ring-brand-600' : ''} ${outsideMonth || outsideFilter ? 'opacity-40' : ''} disabled:cursor-default`}
                aria-selected={selectedDay?.ngay === dateKey}
                aria-label={item ? `${formatFullDate(dateKey)}, ${status?.label}, ${item.slot_da_dat}/${item.tong_slot} slot đã đặt` : formatFullDate(dateKey)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-sm font-bold ${isToday ? 'bg-brand-700 text-white' : 'text-slate-900'}`}>{date.getDate()}</span>
                  {confirmation && (
                    <span title={confirmation.label} className={`flex shrink-0 items-center justify-center rounded-full ${confirmation.className}`} aria-label={confirmation.label}>{confirmation.symbol}</span>
                  )}
                </div>
                {item && status && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                      <span className="truncate text-xs font-semibold text-slate-800">{status.label}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-slate-950">{item.slot_da_dat}<span className="text-sm font-medium text-slate-700">/{item.tong_slot}</span></div>
                    <div className="text-xs text-slate-700">slot đã đặt</div>
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
    <>
      <section className="card overflow-hidden" aria-label="Lịch làm việc bác sĩ">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Lịch làm việc</h2>
            <p className="mt-1 text-sm text-slate-600">Chọn một ngày để xem số liệu và thao tác quản lý.</p>
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
        {calendarBody}
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:px-5">
          {(['lam_viec', 'nghi', 'nghi_phep', 'chua_tao'] as const).map((status) => (
            <span key={status} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden="true" />{STATUS_META[status].label}</span>
          ))}
        </div>
      </section>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDrawer() }}>
          <aside ref={drawerRef} className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="schedule-day-title" aria-describedby="schedule-day-summary">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0 pr-3">
                <h2 id="schedule-day-title" className="text-lg font-semibold capitalize text-slate-950">{formatFullDate(selectedDay.ngay)}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge color={STATUS_META[selectedDay.trang_thai_ngay].badge}>{STATUS_META[selectedDay.trang_thai_ngay].label}</Badge>
                  <Badge color={CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].badge}>{CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].label}</Badge>
                  {selectedDay.canh_bao_xung_dot_xac_nhan && <Badge color="red">Có lịch cần xử lý</Badge>}
                </div>
              </div>
              <button type="button" onClick={closeDrawer} className="btn-icon min-h-11 min-w-11" aria-label="Đóng chi tiết ngày"><Icon name="x" className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              <div id="schedule-day-summary" className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Khung giờ làm việc</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{selectedDay.gio_bat_dau && selectedDay.gio_ket_thuc ? `${selectedDay.gio_bat_dau} – ${selectedDay.gio_ket_thuc}` : 'Chưa có khung giờ làm việc'}</p>
                {selectedDay.ghi_chu_ngay && <p className="mt-2 break-words text-sm text-slate-700">{selectedDay.ghi_chu_ngay}</p>}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200">
                {[
                  ['Tổng slot', selectedDay.tong_slot], ['Slot trống', selectedDay.slot_trong],
                  ['Đã đặt', selectedDay.slot_da_dat], ['Bị khóa / hủy', selectedDay.slot_bi_khoa + selectedDay.slot_da_huy],
                  ['Lịch đang xử lý', selectedDay.so_lich_hen_xung_dot], ['Xác nhận', CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].label],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0 bg-white p-4"><dt className="text-sm text-slate-700">{label}</dt><dd className="mt-1 break-words text-base font-bold text-slate-950">{value}</dd></div>
                ))}
              </dl>

              {selectedDay.canh_bao_xung_dot_xac_nhan && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">Bác sĩ đã từ chối ngày làm việc nhưng vẫn còn {selectedDay.so_lich_hen_xung_dot} lịch hẹn cần xử lý.</div>}
              {selectedDay.ly_do_tu_choi_xac_nhan && <p className="mt-4 break-words text-sm text-red-800">Lý do từ chối: {selectedDay.ly_do_tu_choi_xac_nhan}</p>}
              {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
            </div>

            <div className="border-t border-slate-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              {!selectedDay._id ? (
                <button type="button" onClick={() => onCreateScheduleForDay(selectedDay)} disabled={savingId === selectedDay.ngay || selectedDay.trang_thai_ngay === 'nghi'} className="btn-primary min-h-11 w-full disabled:opacity-50">{savingId === selectedDay.ngay ? 'Đang chạy bù...' : 'Chạy bù lịch cho ngày này'}</button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => onOpenScheduleEditor(selectedDay._id!)} className="btn-primary min-h-11">Chỉnh slot</button>
                  <button type="button" onClick={() => onOpenHistory(selectedDay)} className="btn-secondary min-h-11"><Icon name="clock" className="h-4 w-4" /> Lịch sử</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'lam_viec')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'lam_viec'} className="min-h-11 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">Đánh dấu đi làm</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'nghi')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'nghi' || selectedDay.slot_da_dat > 0} title={selectedDay.slot_da_dat > 0 ? 'Không thể đánh dấu nghỉ khi còn lịch hẹn' : undefined} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Đánh dấu nghỉ</button>
                  <button type="button" onClick={() => onUpdateWorkday(selectedDay, 'nghi_phep')} disabled={savingId === selectedDay._id || selectedDay.trang_thai_ngay === 'nghi_phep' || selectedDay.slot_da_dat > 0} title={selectedDay.slot_da_dat > 0 ? 'Không thể đánh dấu nghỉ phép khi còn lịch hẹn' : undefined} className="min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">Đánh dấu nghỉ phép</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
