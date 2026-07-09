import { useEffect, useState, useMemo } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Toast from '@/components/common/Toast'
import Icon from '@/components/admin/icons'
import { scheduleService } from '@/services/schedule.service'
import { doctorLeaveService } from '@/services/doctor-leave.service'
import type { DoctorSlot } from '@/types'
import { toLocalDateStr } from '@/utils/format'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  active: 'green', booked: 'blue', locked: 'yellow', cancelled: 'red', expired: 'gray', pending_payment: 'yellow',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Còn trống', booked: 'Đã đặt', locked: 'Tạm nghỉ',
  cancelled: 'Đã hủy', expired: 'Hết hạn', pending_payment: 'Đang giữ chỗ',
}
const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// ─── Helpers ──────────────────────────────────────────────────────────────────

// 6 ngày làm việc gần nhất kể từ hôm nay: bỏ Chủ Nhật, không lấy ngày đã qua.
// Đi từng ngày một bắt đầu từ hôm nay — nếu gặp Chủ Nhật thì bỏ qua và ngày kế tiếp
// được tính là Thứ 2 (của tuần sau nếu hôm nay đã qua Thứ 2 tuần này), cứ thế đến khi đủ 6 ngày.
// Vd hôm nay Thứ Tư → Thứ Tư, Thứ Năm, Thứ Sáu, Thứ Bảy, Thứ Hai (tuần sau), Thứ Ba (tuần sau).
function getNext6WorkingDays(todayStr: string): string[] {
  const [y, m, d] = todayStr.split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  const result: string[] = []
  while (result.length < 6) {
    if (cursor.getDay() !== 0) result.push(toLocalDateStr(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DAY_NAMES[dow]}  ·  ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

// ─── Sub: Thanh chấm trạng thái slot theo ngày ────────────────────────────────

function DotBar({ slots }: { slots: DoctorSlot[] }) {
  const dotColor = (s: DoctorSlot) => {
    if (s.status === 'booked') return 'bg-blue-400'
    if (s.status === 'locked') return 'bg-yellow-400'
    if (s.status === 'cancelled' || s.status === 'expired') return 'bg-slate-200'
    return 'bg-emerald-300'
  }
  return (
    <div className="flex flex-wrap gap-[3px]">
      {slots.map((s) => (
        <span key={s.id} className={`h-2 w-2 rounded-full ${dotColor(s)}`} />
      ))}
    </div>
  )
}

// ─── Sub: Summary counts cho header ───────────────────────────────────────────

function DaySummary({ slots }: { slots: DoctorSlot[] }) {
  const booked = slots.filter((s) => s.status === 'booked').length
  const locked = slots.filter((s) => s.status === 'locked').length
  const active = slots.filter((s) => s.status === 'active').length
  const parts: string[] = []
  if (active > 0) parts.push(`${active} trống`)
  if (booked > 0) parts.push(`${booked} đặt`)
  if (locked > 0) parts.push(`${locked} nghỉ`)
  return <span className="text-xs text-slate-400">{parts.join(' · ') || 'Chưa có lịch'}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorSchedule() {
  const todayStr = toLocalDateStr()
  const workingDays = useMemo(() => getNext6WorkingDays(todayStr), [todayStr])

  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([todayStr]))
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Dialog yêu cầu hủy (slot đã có bệnh nhân đặt)
  const [cancelDialog, setCancelDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Dialog gửi yêu cầu nghỉ cho 1 ca
  const [leaveDialog, setLeaveDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  // Ca đã gửi yêu cầu nghỉ trong phiên này — ẩn nút để tránh gửi trùng (chưa có field
  // trạng thái "đã gửi yêu cầu" ở slot, xem docs/Bác sĩ/Audit - Truong du lieu thieu va thua trong DB)
  const [leaveRequestedSlotIds, setLeaveRequestedSlotIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(false)
    scheduleService
      .getAll({ from: workingDays[0], to: workingDays[workingDays.length - 1] })
      .then(setSlots)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [workingDays])

  // Nhóm slot theo ngày — chỉ giữ đúng 6 ngày làm việc đã tính (phòng vệ nếu backend trả dư,
  // vd do khoảng from-to trải dài hơn 6 ngày lịch khi vắt qua Chủ Nhật).
  const slotsByDate = useMemo(() => {
    const validDates = new Set(workingDays)
    const map: Record<string, DoctorSlot[]> = {}
    slots.forEach((s) => {
      if (!validDates.has(s.ngay)) return
      if (!map[s.ngay]) map[s.ngay] = []
      map[s.ngay].push(s)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau)))
    return map
  }, [slots, workingDays])

  const hasAnySlot = slots.some((s) => workingDays.includes(s.ngay))

  function toggleDate(date: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function showError(msg: string) { setActionError(msg) }
  function showSuccess(msg: string) { setActionSuccess(msg) }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function submitCancelRequest() {
    if (!cancelDialog) return
    if (!cancelDialog.ly_do.trim()) {
      showError('Vui lòng nhập lý do trước khi gửi.')
      return
    }
    setCancelSubmitting(true)
    try {
      const { slot, ly_do } = cancelDialog
      await scheduleService.requestCancelSlot(slot, ly_do)
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, cancel_requested: true } : s))
      setCancelDialog(null)
      showSuccess('Đã gửi yêu cầu hủy tới Admin. Chờ xử lý.')
    } catch (err) { showError((err as Error).message) }
    finally { setCancelSubmitting(false) }
  }

  async function submitLeaveRequest() {
    if (!leaveDialog) return
    if (!leaveDialog.ly_do.trim()) {
      showError('Vui lòng nhập lý do trước khi gửi.')
      return
    }
    setLeaveSubmitting(true)
    try {
      const { slot, ly_do } = leaveDialog
      await doctorLeaveService.create(slot.ngay, slot.ngay, ly_do, slot.gio_bat_dau, slot.gio_ket_thuc)
      setLeaveRequestedSlotIds((prev) => new Set(prev).add(slot.id))
      setLeaveDialog(null)
      showSuccess('Đã gửi yêu cầu nghỉ tới Admin. Chờ duyệt.')
    } catch (err) { showError((err as Error).message) }
    finally { setLeaveSubmitting(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="6 ngày làm việc gần nhất (bỏ Chủ Nhật, không tính ngày đã qua). Lịch do hệ thống tự sinh — bạn chỉ có thể xem và gửi yêu cầu nghỉ."
      />

      {/* Toast thông báo góc phải */}
      {actionError && (
        <Toast key={actionError} message={actionError} type="error" onClose={() => setActionError('')} />
      )}
      {actionSuccess && (
        <Toast key={actionSuccess} message={actionSuccess} type="success" onClose={() => setActionSuccess('')} />
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được lịch làm việc. Vui lòng thử lại sau.</p>
        </div>
      ) : !hasAnySlot ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Chưa có lịch làm việc cho 6 ngày tới. Liên hệ Admin để thiết lập.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workingDays.map((date) => {
            const daySlots = slotsByDate[date] ?? []
            const isToday = date === todayStr
            const isExpanded = expandedDates.has(date)

            return (
              <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* ── Header ngày (clickable) ─────────────────────────── */}
                <button
                  type="button"
                  onClick={() => toggleDate(date)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isToday ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {date.split('-')[2]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{formatDayHeader(date)}</span>
                      {isToday && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <DaySummary slots={daySlots} />
                      <DotBar slots={daySlots} />
                    </div>
                  </div>

                  <Icon
                    name="chevron-down"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* ── Danh sách slot ───────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {daySlots.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-400">Chưa có lịch cho ngày này.</p>
                    ) : daySlots.map((slot) => {
                      const canRequestLeave = slot.status === 'active' && !leaveRequestedSlotIds.has(slot.id)
                      const leaveRequested = slot.status === 'active' && leaveRequestedSlotIds.has(slot.id)

                      return (
                        <div key={slot.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                          {/* Ca / giờ */}
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                            <Icon name="clock" className="h-4 w-4 text-brand-400" />
                            {slot.gio_bat_dau} – {slot.gio_ket_thuc}
                          </span>

                          {/* Phòng khám */}
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            {slot.phong_kham ? (
                              <>
                                <Icon name="map-pin" className="h-3 w-3 shrink-0" />
                                {slot.phong_kham}
                              </>
                            ) : (
                              <span className="text-amber-500">⚠ Chưa có phòng</span>
                            )}
                          </span>

                          {/* Y tá hỗ trợ — hệ thống chưa có module gán y tá cho ca làm việc */}
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Icon name="user" className="h-3 w-3 shrink-0" />
                            Chưa phân công y tá
                          </span>

                          {/* Badge trạng thái */}
                          <Badge color={STATUS_COLOR[slot.status]}>{STATUS_LABEL[slot.status]}</Badge>

                          {/* Tên bệnh nhân */}
                          {slot.benh_nhan && (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              <Icon name="user" className="h-3 w-3" />
                              {slot.benh_nhan}
                            </span>
                          )}

                          {/* Nút hành động */}
                          <div className="ml-auto flex items-center gap-2">
                            {canRequestLeave && (
                              <button
                                onClick={() => setLeaveDialog({ slot, ly_do: '' })}
                                className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100"
                              >
                                <Icon name="calendar" className="h-3 w-3" /> Gửi yêu cầu nghỉ
                              </button>
                            )}
                            {leaveRequested && (
                              <span className="inline-flex cursor-default items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-500">
                                <Icon name="clock" className="h-3 w-3" /> Chờ Admin duyệt
                              </span>
                            )}
                            {slot.status === 'booked' && (
                              slot.cancel_requested ? (
                                <span className="inline-flex cursor-default items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-500">
                                  <Icon name="clock" className="h-3 w-3" /> Chờ Admin duyệt
                                </span>
                              ) : (
                                <button
                                  onClick={() => setCancelDialog({ slot, ly_do: '' })}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                                >
                                  <Icon name="alert-circle" className="h-3 w-3" /> Yêu cầu hủy
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Dialog gửi yêu cầu nghỉ cho 1 ca ─────────────────────────────────── */}
      {leaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <Icon name="calendar" className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Gửi yêu cầu nghỉ</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Ca {leaveDialog.slot.gio_bat_dau}–{leaveDialog.slot.gio_ket_thuc} · {formatDayHeader(leaveDialog.slot.ngay)}
                </p>
              </div>
            </div>

            <div className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Yêu cầu sẽ được gửi tới Admin duyệt. Ca chỉ được đánh dấu "Tạm nghỉ" sau khi Admin đồng ý.
            </div>

            <div className="mt-4">
              <label className="input-label">
                Lý do xin nghỉ <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                className="input mt-1 resize-none"
                placeholder="VD: Bác sĩ có việc đột xuất, xin nghỉ ca này..."
                value={leaveDialog.ly_do}
                onChange={(e) => setLeaveDialog({ ...leaveDialog, ly_do: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLeaveDialog(null)}
                className="btn-secondary"
                disabled={leaveSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={submitLeaveRequest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                disabled={leaveSubmitting || !leaveDialog.ly_do.trim()}
              >
                {leaveSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog yêu cầu hủy ca có bệnh nhân ──────────────────────────────── */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Icon name="alert-circle" className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Yêu cầu hủy ca làm việc</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Ca {cancelDialog.slot.gio_bat_dau}–{cancelDialog.slot.gio_ket_thuc} · Bệnh nhân:{' '}
                  <strong>{cancelDialog.slot.benh_nhan}</strong>
                </p>
              </div>
            </div>

            <div className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Yêu cầu sẽ được gửi tới Admin. Admin sẽ liên hệ bệnh nhân và xử lý hoàn tiền nếu cần.
            </div>

            <div className="mt-4">
              <label className="input-label">
                Lý do yêu cầu hủy <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                className="input mt-1 resize-none"
                placeholder="VD: Bác sĩ có việc đột xuất, xin hủy ca và sắp xếp lịch bổ sung..."
                value={cancelDialog.ly_do}
                onChange={(e) => setCancelDialog({ ...cancelDialog, ly_do: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelDialog(null)}
                className="btn-secondary"
                disabled={cancelSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={submitCancelRequest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                disabled={cancelSubmitting || !cancelDialog.ly_do.trim()}
              >
                {cancelSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
