import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Icon from '@/components/admin/icons'
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
import { formatDateTime } from '@/utils/format'

const STATUS_LABEL: Record<AdminDoctorWorkdayItem['trang_thai_ngay'], string> = {
  lam_viec: 'Đi làm',
  nghi: 'Nghỉ',
  nghi_phep: 'Nghỉ phép',
  chua_tao: 'Chưa tạo lịch',
}

const STATUS_COLOR: Record<AdminDoctorWorkdayItem['trang_thai_ngay'], 'green' | 'gray' | 'yellow' | 'red'> = {
  lam_viec: 'green',
  nghi: 'gray',
  nghi_phep: 'yellow',
  chua_tao: 'red',
}

const CONFIRMATION_LABEL: Record<AdminDoctorWorkdayItem['trang_thai_xac_nhan'], string> = {
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  tu_choi: 'Từ chối',
}

const CONFIRMATION_COLOR: Record<AdminDoctorWorkdayItem['trang_thai_xac_nhan'], 'green' | 'gray' | 'yellow' | 'red'> = {
  cho_xac_nhan: 'yellow',
  da_xac_nhan: 'green',
  tu_choi: 'red',
}

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
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
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
                  const immutableStatus = slot.status === 'booked' || slot.status === 'pending_payment'

                  return (
                    <tr key={slot._id}>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={slot.gio_bat_dau}
                          onChange={(event) => updateSlotField(slot._id, 'gio_bat_dau', event.target.value)}
                          className="input w-full"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={slot.gio_ket_thuc}
                          onChange={(event) => updateSlotField(slot._id, 'gio_ket_thuc', event.target.value)}
                          className="input w-full"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={slot.phong_kham || ''}
                          onChange={(event) => updateSlotField(slot._id, 'phong_kham', event.target.value)}
                          className="input w-full"
                          placeholder="Ví dụ: Phòng 101"
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
                          disabled={savingSlotId === slot._id}
                          className="btn-primary disabled:opacity-50"
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

  async function loadWorkdays(currentDoctorId = doctorId, currentFrom = fromDate, currentTo = toDate) {
    if (!currentDoctorId) {
      setItems([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await adminDoctorScheduleService.getWorkdays({
        doctor_id: currentDoctorId,
        from: currentFrom,
        to: currentTo,
      })
      setItems(data.items)
      setDoctorName(data.doctor.ten)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể tải lịch làm việc bác sĩ.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

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
    loadWorkdays()
  }, [doctorId, fromDate, toDate])

  async function updateWorkday(item: AdminDoctorWorkdayItem, nextStatus: 'lam_viec' | 'nghi' | 'nghi_phep') {
    if (!item._id) return

    const note = nextStatus === 'lam_viec'
      ? ''
      : window.prompt('Nhập ghi chú cho ngày này (có thể để trống):', item.ghi_chu_ngay || '') ?? ''

    setSavingId(item._id)
    setError(null)

    try {
      await adminDoctorScheduleService.updateWorkday(item._id, {
        trang_thai_ngay: nextStatus,
        ghi_chu_ngay: note,
      })
      await loadWorkdays()
      if (historyTarget?._id === item._id) await loadHistory(item, historyPage)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể cập nhật trạng thái ngày làm việc.')
    } finally {
      setSavingId(null)
    }
  }

  async function createScheduleForDay(item: AdminDoctorWorkdayItem) {
    setSavingId(item.ngay)
    setError(null)

    try {
      await adminDoctorScheduleService.ensureWorkday({
        doctor_id: doctorId,
        ngay: item.ngay,
      })
      await loadWorkdays()
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
    <div className="space-y-6">
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
            <input type="date" className="input w-full" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Đến ngày</label>
            <input type="date" className="input w-full" value={toDate} onChange={(event) => setToDate(event.target.value)} />
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

      <div className="grid gap-4">
        {!doctorId ? (
          <div className="card px-5 py-12 text-center text-sm text-slate-400">
            Chọn bác sĩ để xem lịch làm việc.
          </div>
        ) : loading ? (
          <div className="card px-5 py-12 text-center text-sm text-slate-400">
            Đang tải lịch làm việc...
          </div>
        ) : items.length === 0 ? (
          <div className="card px-5 py-12 text-center text-sm text-slate-400">
            Không có dữ liệu lịch làm việc trong khoảng ngày đã chọn.
          </div>
        ) : (
          items.map((item) => (
            <div key={`${item.ngay}-${item._id ?? 'derived'}`} className="card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-800">{item.ngay}</h3>
                    <Badge color={STATUS_COLOR[item.trang_thai_ngay]}>{STATUS_LABEL[item.trang_thai_ngay]}</Badge>
                    <Badge color={CONFIRMATION_COLOR[item.trang_thai_xac_nhan] || 'gray'}>
                      {CONFIRMATION_LABEL[item.trang_thai_xac_nhan] || item.trang_thai_xac_nhan}
                    </Badge>
                    {item.nguon_lich === 'derived' && <Badge color="gray">Suy diễn</Badge>}
                    {item.canh_bao_xung_dot_xac_nhan && <Badge color="red">Có lịch cần xử lý</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.gio_bat_dau && item.gio_ket_thuc
                      ? `Khung giờ làm việc: ${item.gio_bat_dau} - ${item.gio_ket_thuc}`
                      : 'Chưa có khung giờ làm việc'}
                  </p>
                  {item.ghi_chu_ngay && <p className="mt-1 text-sm text-slate-500">Ghi chú: {item.ghi_chu_ngay}</p>}
                  {item.ly_do_tu_choi_xac_nhan && (
                    <p className="mt-1 text-sm text-red-600">Lý do từ chối: {item.ly_do_tu_choi_xac_nhan}</p>
                  )}
                </div>

                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:min-w-[380px]">
                  <div>Tổng slot: <span className="font-semibold text-slate-800">{item.tong_slot}</span></div>
                  <div>Slot trống: <span className="font-semibold text-green-700">{item.slot_trong}</span></div>
                  <div>Đã đặt: <span className="font-semibold text-blue-700">{item.slot_da_dat}</span></div>
                  <div>Bị khóa / hủy: <span className="font-semibold text-slate-700">{item.slot_bi_khoa + item.slot_da_huy}</span></div>
                  <div>Lịch đang xử lý: <span className="font-semibold text-slate-800">{item.so_lich_hen_xung_dot}</span></div>
                  <div>Xác nhận: <span className="font-semibold text-slate-800">{CONFIRMATION_LABEL[item.trang_thai_xac_nhan] || item.trang_thai_xac_nhan}</span></div>
                </div>
              </div>

              {item.canh_bao_xung_dot_xac_nhan && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Bác sĩ đã từ chối ngày làm việc này nhưng vẫn còn {item.so_lich_hen_xung_dot} lịch hẹn đang chờ xử lý. Admin cần liên hệ bệnh nhân để đổi lịch hoặc xử lý thủ công.
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!item._id ? (
                  <button
                    type="button"
                    onClick={() => createScheduleForDay(item)}
                    disabled={savingId === item.ngay || item.trang_thai_ngay === 'nghi'}
                    className="btn-primary disabled:opacity-50"
                  >
                    {savingId === item.ngay ? 'Đang chạy bù...' : 'Chạy bù lịch'}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => openScheduleEditor(item._id!)} className="btn-primary">
                      Chỉnh slot
                    </button>
                    <button type="button" onClick={() => openHistory(item)} className="btn-secondary inline-flex items-center gap-2">
                      <Icon name="clock" className="h-4 w-4" />
                      Lịch sử
                    </button>
                    <button
                      type="button"
                      onClick={() => updateWorkday(item, 'lam_viec')}
                      disabled={savingId === item._id}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    >
                      Đánh dấu đi làm
                    </button>
                    <button
                      type="button"
                      onClick={() => updateWorkday(item, 'nghi')}
                      disabled={savingId === item._id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Đánh dấu nghỉ
                    </button>
                    <button
                      type="button"
                      onClick={() => updateWorkday(item, 'nghi_phep')}
                      disabled={savingId === item._id}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Đánh dấu nghỉ phép
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <SlotEditorModal
        schedule={editingSchedule}
        onClose={() => setEditingSchedule(null)}
        onSaved={async () => {
          await loadWorkdays()
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
    </div>
  )
}
