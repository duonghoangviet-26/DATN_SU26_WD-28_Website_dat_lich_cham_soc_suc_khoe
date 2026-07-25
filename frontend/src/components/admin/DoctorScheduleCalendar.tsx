import { useEffect, useRef, useState } from 'react'

import Icon from '@/components/admin/icons'
import Badge from '@/components/common/Badge'
import ScheduleCalendarGrid, { STATUS_META, formatFullDate } from '@/components/common/ScheduleCalendarGrid'
import type { AdminDoctorWorkdayItem } from '@/types'

// Lưới lịch (chuyển tuần/tháng, ô ngày, chú thích) nằm ở ScheduleCalendarGrid — dùng chung
// với trang Lịch làm việc của bác sĩ. File này chỉ còn phần drawer quản trị của Admin.

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
  onViewBookedAppointments?: (item: AdminDoctorWorkdayItem) => void
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
}: DoctorScheduleCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<AdminDoctorWorkdayItem | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null)

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

  return (
    <>
      <ScheduleCalendarGrid
        items={items}
        fromDate={fromDate}
        toDate={toDate}
        loading={loading}
        subtitle="Chọn một ngày để xem số liệu và thao tác quản lý."
        selectedDate={selectedDay?.ngay ?? null}
        onRangeChange={onRangeChange}
        onSelectDay={(item, trigger) => {
          drawerTriggerRef.current = trigger
          setSelectedDay(item)
        }}
        renderDayBadge={(item) => {
          const confirmation = CONFIRMATION_META[item.trang_thai_xac_nhan]
          if (!confirmation) return null
          return (
            <span title={confirmation.label} className={`flex shrink-0 items-center justify-center rounded-full ${confirmation.className}`} aria-label={confirmation.label}>{confirmation.symbol}</span>
          )
        }}
        emptyState={doctorSelected ? undefined : (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <Icon name="doctor" className="h-5 w-5 text-slate-600" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Chưa chọn bác sĩ</p>
            <p className="mt-1 text-sm text-slate-600">Chọn bác sĩ ở bộ lọc để xem lịch làm việc.</p>
          </div>
        )}
      />

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
                  { label: 'Tổng khung giờ', value: selectedDay.tong_slot },
                  { label: 'Khung giờ trống', value: selectedDay.slot_trong },
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
                  { label: 'Lịch đang xử lý', value: selectedDay.so_lich_hen_xung_dot },
                  { label: 'Xác nhận', value: CONFIRMATION_META[selectedDay.trang_thai_xac_nhan].label },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 bg-white p-4">
                    <dt className="text-sm text-slate-700">{item.label}</dt>
                    <dd className="mt-1 break-words text-base font-bold text-slate-950">{item.value}</dd>
                    {item.action}
                  </div>
                ))}
              </dl>

              {selectedDay.slot_trong > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">Trong đó trống:</span>
                  <Badge color="blue">{selectedDay.slot_online_trong} Online</Badge>
                  {selectedDay.slot_walkin_trong > 0 && <Badge color="gray">{selectedDay.slot_walkin_trong} Tại chỗ</Badge>}
                </div>
              )}

              {selectedDay.canh_bao_xung_dot_xac_nhan && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">Bác sĩ đã từ chối ngày làm việc nhưng vẫn còn {selectedDay.so_lich_hen_xung_dot} lịch hẹn cần xử lý.</div>}
              {selectedDay.ly_do_tu_choi_xac_nhan && <p className="mt-4 break-words text-sm text-red-800">Lý do từ chối: {selectedDay.ly_do_tu_choi_xac_nhan}</p>}
              {error && <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
            </div>

            <div className="border-t border-slate-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              {!selectedDay._id ? (
                <button type="button" onClick={() => onCreateScheduleForDay(selectedDay)} disabled={savingId === selectedDay.ngay || selectedDay.trang_thai_ngay === 'nghi'} className="btn-primary min-h-11 w-full disabled:opacity-50">{savingId === selectedDay.ngay ? 'Đang chạy bù...' : 'Chạy bù lịch cho ngày này'}</button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => onOpenScheduleEditor(selectedDay._id!)} className="btn-primary min-h-11">Chỉnh khung giờ</button>
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
