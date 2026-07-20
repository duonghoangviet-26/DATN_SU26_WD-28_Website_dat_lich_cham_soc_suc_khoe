import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Icon from '@/components/admin/icons'
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'
import DoctorScheduleCalendar from '@/components/admin/DoctorScheduleCalendar'
import Badge from '@/components/common/Badge'
import PageHeader from '@/components/common/PageHeader'
import TablePaginationFooter from '@/components/common/TablePaginationFooter'
import { adminDoctorScheduleService } from '@/services/admin-doctor-schedule.service'
import { appointmentService } from '@/services/appointment.service'
import type {
  AdminAppointmentDoctorOption,
  AdminDoctorScheduleAuditLog,
  AdminDoctorScheduleDetail,
  AdminDoctorScheduleSlot,
  AdminDoctorWorkdayItem,
} from '@/types'
import { formatDateTime, toLocalDateStr } from '@/utils/format'

const MAX_CALENDAR_RANGE_DAYS = 42

const SLOT_STATUS_OPTIONS: AdminDoctorScheduleSlot['status'][] = [
  'active',
  'locked',
  'cancelled',
  'expired',
  'pending_payment',
  'booked',
]

const SLOT_STATUS_LABEL: Record<AdminDoctorScheduleSlot['status'], string> = {
  active: 'Còn trống',
  locked: 'Bị khóa',
  cancelled: 'Đã hủy',
  expired: 'Đã hết hạn',
  pending_payment: 'Chờ thanh toán',
  booked: 'Đã đặt lịch',
}

const SLOT_STATUS_SELECT_CLASS: Record<AdminDoctorScheduleSlot['status'], string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800 focus:border-emerald-400 focus:ring-emerald-100',
  locked: 'border-slate-200 bg-slate-50 text-slate-700 focus:border-slate-400 focus:ring-slate-100',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100',
  expired: 'border-amber-200 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-100',
  pending_payment: 'border-blue-200 bg-blue-50 text-blue-800 focus:border-blue-400 focus:ring-blue-100',
  booked: 'border-indigo-200 bg-indigo-50 text-indigo-800 focus:border-indigo-400 focus:ring-indigo-100',
}

const ACTION_LABEL: Record<AdminDoctorScheduleAuditLog['hanh_dong'], string> = {
  auto_generate: 'Tự động sinh lịch',
  manual_create: 'Tạo lịch thủ công',
  update_workday: 'Cập nhật ngày',
  update_slot: 'Cập nhật slot',
  doctor_confirm: 'Bác sĩ xác nhận',
  doctor_reject: 'Bác sĩ từ chối',
  doctor_request_cancel_slot: 'Bác sĩ xin hủy slot',
}

const ACTION_COLOR: Record<AdminDoctorScheduleAuditLog['hanh_dong'], 'green' | 'gray' | 'yellow' | 'red' | 'blue'> = {
  auto_generate: 'blue',
  manual_create: 'green',
  update_workday: 'yellow',
  update_slot: 'blue',
  doctor_confirm: 'green',
  doctor_reject: 'red',
  doctor_request_cancel_slot: 'red',
}

function getDefaultRange() {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + 13)
  return {
    from: toLocalDateStr(from),
    to: toLocalDateStr(to),
  }
}

function validateDateRange(from: string, to: string) {
  if (!from || !to) return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'

  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Khoảng ngày không hợp lệ.'
  if (end < start) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (dayCount > MAX_CALENDAR_RANGE_DAYS) {
    return `Chỉ có thể xem tối đa ${MAX_CALENDAR_RANGE_DAYS} ngày mỗi lần.`
  }

  return null
}

function addDaysToDateString(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  date.setDate(date.getDate() + amount)
  return toLocalDateStr(date)
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Không có'
  if (Array.isArray(value)) return `${value.length} mục`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function diffFields(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
  return keys.filter((key) => valueToText(before?.[key]) !== valueToText(after?.[key]))
}

// ============================================================
// MODAL: CHỈNH SLOT LỊCH LÀM VIỆC
// ============================================================

function SlotEditorModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: AdminDoctorScheduleDetail | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const itemsPerPage = 8
  const [workingCopy, setWorkingCopy] = useState<AdminDoctorScheduleDetail | null>(schedule)
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setWorkingCopy(schedule)
    setError(null)
    setSavingSlotId(null)
    setPage(1)
  }, [schedule])

  if (!workingCopy) return null

  const totalPages = Math.max(1, Math.ceil(workingCopy.slots.length / itemsPerPage))
  const visibleSlots = workingCopy.slots.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  async function saveSlot(slot: AdminDoctorScheduleSlot) {
    setSavingSlotId(slot._id)
    setError(null)

    try {
      const updated = await adminDoctorScheduleService.updateSlot(workingCopy._id, slot._id, {
        gio_bat_dau: slot.gio_bat_dau,
        gio_ket_thuc: slot.gio_ket_thuc,
        phong_kham: slot.phong_kham || null,
        status: slot.status,
      })
      setWorkingCopy(updated)
      await onSaved()
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể lưu slot.')
    } finally {
      setSavingSlotId(null)
    }
  }

  function updateSlotField(slotId: string, field: keyof AdminDoctorScheduleSlot, value: string) {
    setWorkingCopy((current) => {
      if (!current) return current
      return {
        ...current,
        slots: current.slots.map((slot) => (slot._id === slotId ? { ...slot, [field]: value } : slot)),
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Chỉnh lịch làm việc bác sĩ</h3>
            <p className="mt-1 text-sm text-slate-500">
              Ngày {workingCopy.ngay} • {workingCopy.slots.length} slot
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary">Đóng</button>
        </div>

        <div className="overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Bắt đầu</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Kết thúc</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Phòng khám</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Đặt lịch</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Lưu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSlots.map((slot) => {
                  const immutableStatus = slot.status === 'booked' || slot.status === 'pending_payment' || slot.co_lich_hen === true

                  return (
                    <tr key={slot._id}>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={slot.gio_bat_dau}
                          onChange={(event) => updateSlotField(slot._id, 'gio_bat_dau', event.target.value)}
                          className="input w-full"
                          disabled={immutableStatus}
                          title={immutableStatus ? 'Không thể đổi giờ của slot đã có lịch hẹn' : undefined}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={slot.gio_ket_thuc}
                          onChange={(event) => updateSlotField(slot._id, 'gio_ket_thuc', event.target.value)}
                          className="input w-full"
                          disabled={immutableStatus}
                          title={immutableStatus ? 'Không thể đổi giờ của slot đã có lịch hẹn' : undefined}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={slot.phong_kham || ''}
                          onChange={(event) => updateSlotField(slot._id, 'phong_kham', event.target.value)}
                          className="input w-full"
                          placeholder="Ví dụ: Phòng 101"
                          disabled={immutableStatus}
                          title={immutableStatus ? 'Không thể đổi phòng của slot đã có lịch hẹn' : undefined}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={slot.status}
                          onChange={(event) => updateSlotField(slot._id, 'status', event.target.value)}
                          className={`h-10 w-full rounded-xl border px-3 text-sm font-semibold shadow-sm outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none ${SLOT_STATUS_SELECT_CLASS[slot.status]}`}
                          disabled={immutableStatus}
                          title={immutableStatus ? 'Slot đã có lịch hoặc đang chờ thanh toán nên không thể đổi trạng thái tại đây' : 'Chọn trạng thái slot'}
                        >
                          {SLOT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {SLOT_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {slot.status === 'booked'
                          ? 'Đã có bệnh nhân'
                          : slot.status === 'pending_payment'
                            ? 'Đang chờ thanh toán'
                            : 'Chưa có bệnh nhân'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => saveSlot(slot)}
                          disabled={savingSlotId === slot._id || immutableStatus}
                          className="btn-primary disabled:opacity-50"
                          title={immutableStatus ? 'Slot đã có lịch hẹn nên không thể chỉnh sửa' : undefined}
                        >
                          {savingSlotId === slot._id ? 'Đang lưu...' : 'Lưu slot'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {workingCopy.slots.length > itemsPerPage && (
            <TablePaginationFooter
              currentPage={page}
              totalPages={totalPages}
              totalItems={workingCopy.slots.length}
              currentItemCount={visibleSlots.length}
              itemLabel="slot"
              pageSize={itemsPerPage}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MODAL: ĐÁNH DẤU NGHỈ / NGHỈ PHÉP (thay thế window.prompt)
// ============================================================

const DAY_OFF_TYPE_CONFIG = {
  nghi: {
    label: 'Đánh dấu nghỉ',
    description: 'Bác sĩ nghỉ không có lý do hoặc nghỉ đột xuất.',
    icon: '🚫',
    iconBg: 'bg-slate-100',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    confirmClass: 'bg-slate-800 hover:bg-slate-900 text-white',
    notePlaceholder: 'VD: Nghỉ đột xuất do lý do cá nhân...',
  },
  nghi_phep: {
    label: 'Đánh dấu nghỉ phép',
    description: 'Bác sĩ có phép nghỉ được duyệt trước.',
    icon: '🌴',
    iconBg: 'bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    notePlaceholder: 'VD: Nghỉ phép năm theo đơn đã duyệt...',
  },
} as const

function MarkDayOffModal({
  item,
  type,
  onConfirm,
  onCancel,
  saving,
}: {
  item: AdminDoctorWorkdayItem
  type: 'nghi' | 'nghi_phep'
  onConfirm: (note: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [note, setNote] = useState(item.ghi_chu_ngay || '')
  const cfg = DAY_OFF_TYPE_CONFIG[type]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(note)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" style={{ animation: 'fadeInScale 0.18s ease-out' }}>
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 pb-4 pt-6">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl ${cfg.iconBg}`}>
            {cfg.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">{cfg.label}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{cfg.description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Thông tin ngày */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Icon name="clock" className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <div className="text-sm">
              <span className="text-slate-500">Ngày áp dụng: </span>
              <span className="font-bold text-slate-800">{item.ngay}</span>
            </div>
            <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}>
              {cfg.label}
            </span>
          </div>

          {/* Ô ghi chú */}
          <div>
            <label htmlFor="day-off-note" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Ghi chú{' '}
              <span className="font-normal text-slate-400">(không bắt buộc)</span>
            </label>
            <textarea
              id="day-off-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={cfg.notePlaceholder}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${cfg.confirmClass}`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="refresh-cw" className="h-4 w-4 animate-spin" />
                  Đang lưu...
                </span>
              ) : (
                cfg.label
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// MODAL: LỊCH SỬ CHỈNH SỬA
// ============================================================

function ScheduleAuditModal({
  title,
  logs,
  loading,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onClose,
}: {
  title: string
  logs: AdminDoctorScheduleAuditLog[]
  loading: boolean
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Lịch sử chỉnh sửa</h3>
            <p className="mt-1 text-sm text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng lịch sử"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Icon name="refresh-cw" className="mr-2 h-5 w-5 animate-spin" />
              Đang tải lịch sử...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Chưa có lịch sử chỉnh sửa cho lịch làm việc này.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const changedFields = diffFields(log.du_lieu_cu, log.du_lieu_moi)

                return (
                  <article key={log._id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={ACTION_COLOR[log.hanh_dong] || 'gray'}>
                          {ACTION_LABEL[log.hanh_dong] || log.hanh_dong}
                        </Badge>
                        <span className="text-xs font-medium text-slate-500">{formatDateTime(log.thoi_diem)}</span>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {log.vai_tro === 'system' ? 'Hệ thống' : log.vai_tro}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-[180px,1fr]">
                      <div className="text-slate-500">
                        <div className="font-medium text-slate-700">{log.nguoi_thuc_hien}</div>
                        {log.nguoi_thuc_hien_email && <div className="mt-0.5 text-xs">{log.nguoi_thuc_hien_email}</div>}
                        {log.ngay && <div className="mt-2 text-xs">Ngày lịch: {log.ngay}</div>}
                      </div>

                      <div>
                        {log.ghi_chu && <p className="font-medium text-slate-800">{log.ghi_chu}</p>}

                        {changedFields.length > 0 ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">Trường</th>
                                  <th className="px-3 py-2 font-semibold">Trước</th>
                                  <th className="px-3 py-2 font-semibold">Sau</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {changedFields.slice(0, 8).map((field) => (
                                  <tr key={field}>
                                    <td className="px-3 py-2 font-medium text-slate-700">{field}</td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-500">{valueToText(log.du_lieu_cu?.[field])}</td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-800">{valueToText(log.du_lieu_moi?.[field])}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {changedFields.length > 8 && (
                              <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                                Còn {changedFields.length - 8} trường khác được ghi trong log.
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Không có dữ liệu trước/sau để so sánh.</p>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {!loading && logs.length > 0 && (
            <TablePaginationFooter
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              currentItemCount={logs.length}
              itemLabel="log"
              pageSize={10}
              onPageChange={onPageChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TRANG CHÍNH: QUẢN LÝ LỊCH LÀM VIỆC BÁC SĨ
// ============================================================

export default function ManageDoctorSchedules() {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultRange = getDefaultRange()

  const [doctorId, setDoctorId] = useState(searchParams.get('doctor_id') || '')
  const [doctorName, setDoctorName] = useState(searchParams.get('doctor_name') || '')
  const [fromDate, setFromDate] = useState(defaultRange.from)
  const [toDate, setToDate] = useState(defaultRange.to)
  const [doctors, setDoctors] = useState<AdminAppointmentDoctorOption[]>([])
  const [items, setItems] = useState<AdminDoctorWorkdayItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<AdminDoctorScheduleDetail | null>(null)
  const [historyTarget, setHistoryTarget] = useState<AdminDoctorWorkdayItem | null>(null)
  const [historyLogs, setHistoryLogs] = useState<AdminDoctorScheduleAuditLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPagination, setHistoryPagination] = useState({ total: 0, totalPages: 1 })
  const workdayRequestId = useRef(0)

  // State cho modal đánh dấu nghỉ — thay thế window.prompt
  const [markDayOff, setMarkDayOff] = useState<{
    item: AdminDoctorWorkdayItem
    type: 'nghi' | 'nghi_phep'
  } | null>(null)

  const loadWorkdays = useCallback(async (
    currentDoctorId: string,
    currentFrom: string,
    currentTo: string,
    signal?: AbortSignal,
  ) => {
    const requestId = ++workdayRequestId.current

    if (!currentDoctorId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }

    const validationError = validateDateRange(currentFrom, currentTo)
    if (validationError) {
      setError(validationError)
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await adminDoctorScheduleService.getWorkdays({
        doctor_id: currentDoctorId,
        from: currentFrom,
        to: currentTo,
      }, signal)
      if (signal?.aborted || requestId !== workdayRequestId.current) return
      setItems(data.items)
      setDoctorName(data.doctor.ten)
    } catch (nextError: any) {
      if (signal?.aborted || nextError?.code === 'ERR_CANCELED' || requestId !== workdayRequestId.current) return
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể tải lịch làm việc bác sĩ.')
      setItems([])
    } finally {
      if (!signal?.aborted && requestId === workdayRequestId.current) setLoading(false)
    }
  }, [])

  async function loadHistory(target: AdminDoctorWorkdayItem, page = 1) {
    if (!target._id) return

    setHistoryLoading(true)
    setError(null)

    try {
      const data = await adminDoctorScheduleService.getAuditLogs({
        schedule_id: target._id,
        page,
        limit: 10,
      })
      setHistoryLogs(data.items)
      setHistoryPage(data.pagination.page)
      setHistoryPagination({
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      })
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể tải lịch sử chỉnh sửa.')
      setHistoryLogs([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    appointmentService.getActiveDoctors()
      .then((data) => {
        if (!ignore) setDoctors(data)
      })
      .catch(() => {
        if (!ignore) setError('Không thể tải danh sách bác sĩ.')
      })
      .finally(() => {
        if (!ignore) setLoadingDoctors(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadWorkdays(doctorId, fromDate, toDate, controller.signal)
    return () => controller.abort()
  }, [doctorId, fromDate, loadWorkdays, toDate])

  // Hàm thực sự gọi API sau khi người dùng xác nhận trong modal
  async function executeUpdateWorkday(
    item: AdminDoctorWorkdayItem,
    nextStatus: 'lam_viec' | 'nghi' | 'nghi_phep',
    note: string,
  ) {
    if (!item._id) return

    setSavingId(item._id)
    setError(null)

    try {
      await adminDoctorScheduleService.updateWorkday(item._id, {
        trang_thai_ngay: nextStatus,
        ghi_chu_ngay: note,
      })
      await loadWorkdays(doctorId, fromDate, toDate)
      if (historyTarget?._id === item._id) await loadHistory(item, historyPage)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể cập nhật trạng thái ngày làm việc.')
    } finally {
      setSavingId(null)
    }
  }

  // Hàm được gọi từ DoctorScheduleCalendar — mở modal thay vì window.prompt
  async function updateWorkday(item: AdminDoctorWorkdayItem, nextStatus: 'lam_viec' | 'nghi' | 'nghi_phep') {
    if (!item._id) return

    if (nextStatus === 'lam_viec') {
      // Đánh dấu đi làm không cần ghi chú → thực hiện ngay
      await executeUpdateWorkday(item, nextStatus, '')
    } else {
      // Đánh dấu nghỉ / nghỉ phép → mở modal form
      setMarkDayOff({ item, type: nextStatus as 'nghi' | 'nghi_phep' })
    }
  }

  // Callback khi người dùng xác nhận trong MarkDayOffModal
  async function handleMarkDayOffConfirm(note: string) {
    if (!markDayOff) return
    const { item, type } = markDayOff
    setMarkDayOff(null)
    await executeUpdateWorkday(item, type, note)
  }

  async function createScheduleForDay(item: AdminDoctorWorkdayItem) {
    setSavingId(item.ngay)
    setError(null)

    try {
      await adminDoctorScheduleService.ensureWorkday({
        doctor_id: doctorId,
        ngay: item.ngay,
      })
      await loadWorkdays(doctorId, fromDate, toDate)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể sinh lịch tự động cho ngày trống.')
    } finally {
      setSavingId(null)
    }
  }

  async function openScheduleEditor(scheduleId: string) {
    setError(null)
    try {
      const data = await adminDoctorScheduleService.getScheduleById(scheduleId)
      setEditingSchedule(data)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể mở lịch để chỉnh sửa.')
    }
  }

  async function openHistory(item: AdminDoctorWorkdayItem) {
    if (!item._id) return
    setHistoryTarget(item)
    setHistoryLogs([])
    setHistoryPage(1)
    setHistoryPagination({ total: 0, totalPages: 1 })
    await loadHistory(item, 1)
  }

  const summary = {
    total: items.length,
    working: items.filter((item) => item.trang_thai_ngay === 'lam_viec').length,
    dayOff: items.filter((item) => item.trang_thai_ngay === 'nghi').length,
    leave: items.filter((item) => item.trang_thai_ngay === 'nghi_phep').length,
    missing: items.filter((item) => item.trang_thai_ngay === 'chua_tao').length,
    confirmed: items.filter((item) => item.trang_thai_xac_nhan === 'da_xac_nhan').length,
    conflicts: items.filter((item) => item.canh_bao_xung_dot_xac_nhan).length,
  }

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader
        title="Lịch làm việc bác sĩ"
        description="Lịch làm việc được hệ thống tự động sinh và bù theo tuần. Admin theo dõi trạng thái xác nhận, chỉnh slot khi có thay đổi đặc biệt và xem lịch sử để truy vết."
      />

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Bác sĩ</label>
            <select
              className="input w-full"
              value={doctorId}
              onChange={(event) => {
                const nextDoctorId = event.target.value
                const selected = doctors.find((doctor) => doctor._id === nextDoctorId)
                setDoctorId(nextDoctorId)
                setDoctorName(selected?.ten || '')

                const next = new URLSearchParams(searchParams)
                if (nextDoctorId) {
                  next.set('doctor_id', nextDoctorId)
                  next.set('doctor_name', selected?.ten || '')
                } else {
                  next.delete('doctor_id')
                  next.delete('doctor_name')
                }
                setSearchParams(next)
              }}
              disabled={loadingDoctors}
            >
              <option value="">-- Chọn bác sĩ --</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.ten} ({doctor.chuyen_khoa})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Từ ngày</label>
            <input
              type="date"
              className="input w-full"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Đến ngày</label>
            <input
              type="date"
              className="input w-full"
              value={toDate}
              min={fromDate || undefined}
              max={fromDate ? addDaysToDateString(fromDate, MAX_CALENDAR_RANGE_DAYS - 1) : undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-medium text-slate-700">Bác sĩ đang xem</div>
            <div className="mt-1">{doctorName || 'Chưa chọn bác sĩ'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {[
          { label: 'Tổng ngày', value: summary.total, color: 'text-slate-700' },
          { label: 'Đi làm', value: summary.working, color: 'text-green-600' },
          { label: 'Nghỉ', value: summary.dayOff, color: 'text-slate-500' },
          { label: 'Nghỉ phép', value: summary.leave, color: 'text-amber-600' },
          { label: 'Chưa tạo lịch', value: summary.missing, color: 'text-red-600' },
          { label: 'Đã xác nhận', value: summary.confirmed, color: 'text-emerald-600' },
          { label: 'Cảnh báo', value: summary.conflicts, color: 'text-red-600' },
        ].map((item) => (
          <div key={item.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Lịch làm việc được tự động tạo khi backend khởi động và vào 00:00 Chủ nhật hằng tuần. Trạng thái `Chưa tạo lịch` chỉ còn là cảnh báo dữ liệu thiếu; nút chạy bù là phương án dự phòng khi cần xử lý ngay.
      </div>

      <DoctorScheduleCalendar
        items={items}
        fromDate={fromDate}
        toDate={toDate}
        doctorSelected={Boolean(doctorId)}
        loading={loading}
        savingId={savingId}
        error={error}
        onRangeChange={(from, to) => {
          setFromDate(from)
          setToDate(to)
        }}
        onOpenScheduleEditor={openScheduleEditor}
        onOpenHistory={openHistory}
        onUpdateWorkday={updateWorkday}
        onCreateScheduleForDay={createScheduleForDay}
      />

      <SlotEditorModal
        schedule={editingSchedule}
        onClose={() => setEditingSchedule(null)}
        onSaved={async () => {
          await loadWorkdays(doctorId, fromDate, toDate)
          if (historyTarget) await loadHistory(historyTarget, historyPage)
        }}
      />

      {historyTarget && (
        <ScheduleAuditModal
          title={`${doctorName || 'Bác sĩ'} • ${historyTarget.ngay}`}
          logs={historyLogs}
          loading={historyLoading}
          page={historyPage}
          totalPages={historyPagination.totalPages}
          totalItems={historyPagination.total}
          onPageChange={(nextPage) => loadHistory(historyTarget, nextPage)}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* Modal đánh dấu nghỉ — thay thế window.prompt */}
      {markDayOff && (
        <MarkDayOffModal
          item={markDayOff.item}
          type={markDayOff.type}
          saving={savingId === markDayOff.item._id}
          onConfirm={handleMarkDayOffConfirm}
          onCancel={() => setMarkDayOff(null)}
        />
      )}

    </AdminAutoStagger>
  )
}
