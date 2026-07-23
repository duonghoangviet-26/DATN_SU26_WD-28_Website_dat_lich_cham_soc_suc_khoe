import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Toast from '@/components/common/Toast'
import Modal from '@/components/common/Modal'
import Empty from '@/components/common/Empty'
import Icon from '@/components/admin/icons'
import { scheduleService } from '@/services/schedule.service'
import { doctorLeaveService } from '@/services/doctor-leave.service'
import type { DoctorSlot, DoctorLeaveRequest, DoctorScheduleDetail } from '@/types'
import { toLocalDateStr } from '@/utils/format'
import { parseLocalDate, getMondayOfWeek, addDays, findCoveringLeave, todayTimeStatus } from '@/utils/scheduleWeek'
import {
  SCHEDULE_SLOT_STATUS_COLOR,
  SCHEDULE_DAY_STATUS_LABEL,
  SCHEDULE_DAY_STATUS_COLOR,
  DOCTOR_LEAVE_STATUS_COLOR,
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  SLOT_LOAI_LABEL,
  SLOT_LOAI_COLOR,
} from '@/utils/constants'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'Còn trống', booked: 'Đã đặt', locked: 'Tạm nghỉ',
  cancelled: 'Đã hủy', expired: 'Hết hạn', pending_payment: 'Đang giữ chỗ',
}
const LEAVE_STATUS_LABEL: Record<string, string> = {
  cho_duyet: 'Chờ Admin duyệt', da_duyet: 'Đã duyệt nghỉ', tu_choi: 'Bị từ chối', da_huy: 'Đã rút',
}
const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// ─── Helpers thời gian ────────────────────────────────────────────────────────
// getMondayOfWeek/addDays/findCoveringLeave/todayTimeStatus: xem frontend/src/utils/scheduleWeek.ts
// (tách riêng để unit test độc lập, không phụ thuộc React).

function formatDayHeader(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return `${DAY_NAMES[d.getDay()]}  ·  ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function isAbortError(err: unknown): boolean {
  const e = err as { code?: string; name?: string } | null
  return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError'
}

// ─── Nhóm slot theo khung giờ (Ca → Khung giờ → Slot) ─────────────────────────
// Nhiều slot có thể dùng chung 1 khung 30' (cấu hình so_slot_moi_khung > 1) — gom lại
// theo giờ bắt đầu/kết thúc để tránh lặp lại header giờ nhiều lần, dễ nhìn hơn.
interface KhungGroup {
  gio_bat_dau: string
  gio_ket_thuc: string
  slots: DoctorSlot[]
}

function groupSlotsByKhung(slots: DoctorSlot[]): KhungGroup[] {
  const groups: KhungGroup[] = []
  const indexByTime = new Map<string, number>()
  slots.forEach((slot) => {
    const key = `${slot.gio_bat_dau}-${slot.gio_ket_thuc}`
    const existingIndex = indexByTime.get(key)
    if (existingIndex === undefined) {
      indexByTime.set(key, groups.length)
      groups.push({ gio_bat_dau: slot.gio_bat_dau, gio_ket_thuc: slot.gio_ket_thuc, slots: [slot] })
    } else {
      groups[existingIndex].slots.push(slot)
    }
  })
  return groups
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
  const activeSlots = slots.filter((s) => s.status === 'active')
  const onlineTrong = activeSlots.filter((s) => (s.loai_slot ?? 'online') !== 'walk_in').length
  const walkinTrong = activeSlots.filter((s) => s.loai_slot === 'walk_in').length
  const parts: string[] = []
  if (activeSlots.length > 0) {
    const breakdown = walkinTrong > 0 ? ` (${onlineTrong} online · ${walkinTrong} tại chỗ)` : ''
    parts.push(`${activeSlots.length} trống${breakdown}`)
  }
  if (booked > 0) parts.push(`${booked} đặt`)
  if (locked > 0) parts.push(`${locked} nghỉ`)
  return <span className="text-xs text-slate-400">{parts.join(' · ') || 'Chưa có lịch'}</span>
}

// ─── Sub: Modal chi tiết 1 ngày làm việc ──────────────────────────────────────

function ScheduleDetailModal({ scheduleId, onClose }: { scheduleId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<DoctorScheduleDetail | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    scheduleService.getDetail(scheduleId, controller.signal)
      .then(setDetail)
      .catch((err) => { if (!isAbortError(err)) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scheduleId])

  const phongList = detail ? [...new Set(detail.slots.map((s) => s.phong_kham).filter((p): p is string => !!p))] : []

  return (
    <Modal isOpen onClose={onClose} title="Chi tiết ngày làm việc" size="xl">
      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error || !detail ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-600">Không tải được chi tiết ca. Vui lòng thử lại sau.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Thông tin ngày */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{formatDayHeader(detail.ngay)}</span>
            {detail.trang_thai_ngay && detail.trang_thai_ngay !== 'lam_viec' && (
              <Badge color={SCHEDULE_DAY_STATUS_COLOR[detail.trang_thai_ngay]}>
                {SCHEDULE_DAY_STATUS_LABEL[detail.trang_thai_ngay]}
              </Badge>
            )}
          </div>
          {detail.ghi_chu_ngay && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {detail.ghi_chu_ngay}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" />
              Y tá hỗ trợ: <span className="font-medium text-slate-800">{detail.nurse ?? 'Chưa phân công'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Icon name="map-pin" className="h-4 w-4 shrink-0 text-slate-400" />
              Phòng khám: <span className="font-medium text-slate-800">{phongList.length > 0 ? phongList.join(', ') : 'Chưa phân công'}</span>
            </div>
          </div>

          {detail.thong_ke.slot_trong > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {detail.thong_ke.slot_trong} khung giờ còn trống
              <Badge color={SLOT_LOAI_COLOR.online}>{detail.thong_ke.slot_online_trong} {SLOT_LOAI_LABEL.online}</Badge>
              {detail.thong_ke.slot_walkin_trong > 0 && (
                <Badge color={SLOT_LOAI_COLOR.walk_in}>{detail.thong_ke.slot_walkin_trong} {SLOT_LOAI_LABEL.walk_in}</Badge>
              )}
            </div>
          )}

          {/* Thống kê rút gọn — chỉ số liệu API trả, không suy đoán */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Tổng lịch hẹn', value: detail.thong_ke.tong_lich_hen },
              { label: 'Đã đến / đang khám', value: detail.thong_ke.da_den + detail.thong_ke.dang_kham },
              { label: 'Hoàn thành', value: detail.thong_ke.hoan_thanh },
              { label: 'Hủy / không đến', value: detail.thong_ke.da_huy + detail.thong_ke.khong_den },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                <p className="text-lg font-bold text-slate-800">{tile.value}</p>
                <p className="text-[11px] text-slate-500">{tile.label}</p>
              </div>
            ))}
          </div>

          {/* Danh sách lịch hẹn thuộc ca */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lịch hẹn trong ngày ({detail.lich_hen.length})
            </p>
            {detail.lich_hen.length === 0 ? (
              <Empty icon="calendar" title="Chưa có lịch hẹn" description="Ngày này chưa có bệnh nhân nào đặt lịch." />
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {detail.lich_hen.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-slate-700">{a.gio_kham}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.benh_nhan}</span>
                    {a.la_khach_vang_lai && <Badge color="gray">Khách vãng lai</Badge>}
                    {a.ten_dich_vu && <span className="text-xs text-slate-400">{a.ten_dich_vu}</span>}
                    <Badge color={APPOINTMENT_STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                    <Badge color={PAYMENT_STATUS_COLOR[a.payment_status]}>{PAYMENT_STATUS_LABEL[a.payment_status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <Button variant="secondary" size="sm" onClick={onClose}>Đóng</Button>
            {detail.lich_hen.length > 0 && (
              <Button variant="primary" size="sm" onClick={() => navigate('/doctor/appointments')}
                icon={<Icon name="eye" className="h-3.5 w-3.5" />}>
                Xem trong Lịch hẹn của tôi
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorSchedule() {
  const todayStr = toLocalDateStr()

  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const monday = useMemo(() => getMondayOfWeek(weekAnchor), [weekAnchor])
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => toLocalDateStr(addDays(monday, i))), [monday])
  const mondayStr = weekDays[0]
  const saturdayStr = weekDays[5]
  const isCurrentWeek = mondayStr === toLocalDateStr(getMondayOfWeek(new Date()))

  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([todayStr]))
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Yêu cầu nghỉ thật của bác sĩ — dùng để đối chiếu với từng slot (GAP-5), không phụ thuộc
  // state RAM tạm thời. Tải 1 lần, tải lại sau khi gửi/rút yêu cầu.
  const [leaves, setLeaves] = useState<DoctorLeaveRequest[]>([])
  const loadLeaves = useCallback(() => {
    doctorLeaveService.list().then(setLeaves).catch(() => {})
  }, [])
  useEffect(() => { loadLeaves() }, [loadLeaves])

  // Modal chi tiết ngày làm việc
  const [detailScheduleId, setDetailScheduleId] = useState<string | null>(null)

  // Dialog yêu cầu hủy (slot đã có bệnh nhân đặt)
  const [cancelDialog, setCancelDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Dialog gửi yêu cầu nghỉ cho 1 slot
  const [leaveDialog, setLeaveDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)

  // Tăng để buộc tải lại dữ liệu tuần hiện tại (nút "Thử lại" khi lỗi) — đổi weekAnchor không
  // đủ vì mondayStr/saturdayStr (derive từ weekAnchor) không đổi khi bấm lại đúng tuần đang xem.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    scheduleService
      .getAll({ from: mondayStr, to: saturdayStr }, controller.signal)
      .then(setSlots)
      .catch((err) => { if (!isAbortError(err)) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [mondayStr, saturdayStr, reloadKey])

  const slotsByDate = useMemo(() => {
    const map: Record<string, DoctorSlot[]> = {}
    slots.forEach((s) => {
      if (!map[s.ngay]) map[s.ngay] = []
      map[s.ngay].push(s)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau)))
    return map
  }, [slots])

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
      const created = await doctorLeaveService.create(slot.ngay, slot.ngay, ly_do, slot.gio_bat_dau, slot.gio_ket_thuc)
      setLeaveDialog(null)
      loadLeaves() // tải lại danh sách thật — nút "Gửi yêu cầu nghỉ" sẽ tự ẩn nhờ đối chiếu (GAP-5)
      showSuccess(
        created.so_lich_hen_anh_huong && created.so_lich_hen_anh_huong > 0
          ? `Đã gửi yêu cầu nghỉ tới Admin. Có ${created.so_lich_hen_anh_huong} lịch hẹn sẽ bị ảnh hưởng.`
          : 'Đã gửi yêu cầu nghỉ tới Admin. Chờ duyệt.'
      )
    } catch (err) { showError((err as Error).message) }
    finally { setLeaveSubmitting(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="Lịch làm việc theo tuần — do hệ thống tự sinh, bạn chỉ có thể xem và gửi yêu cầu nghỉ."
      >
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setWeekAnchor(addDays(monday, -7))}
            icon={<Icon name="chevron-down" className="h-3.5 w-3.5 rotate-90" />}>
            Tuần trước
          </Button>
          <Button variant={isCurrentWeek ? 'secondary' : 'primary'} size="sm" onClick={() => setWeekAnchor(new Date())}>
            Hôm nay
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekAnchor(addDays(monday, 7))}
            icon={<Icon name="chevron-down" className="h-3.5 w-3.5 -rotate-90" />}>
            Tuần sau
          </Button>
        </div>
      </PageHeader>

      <p className="-mt-4 mb-4 text-sm font-medium text-slate-500">
        Tuần {formatDayHeader(mondayStr).split('  ·  ')[1]} – {formatDayHeader(saturdayStr).split('  ·  ')[1]}
      </p>

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
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Tuần này chưa có lịch làm việc. Liên hệ Admin để thiết lập.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDays.map((date) => {
            const daySlots = slotsByDate[date] ?? []
            const isToday = date === todayStr
            const isPastDay = date < todayStr
            const isExpanded = expandedDates.has(date)

            // Bất thường dữ liệu THẬT phát hiện được (không phải lỗi FE): 1 ngày có thể có
            // >1 document LichLamViec (schedule_id khác nhau) — unique index {doctor_id, ngay}
            // không bắt được vì 2 document có Date instant khác nhau dù cùng ngày lịch, rất có
            // thể do seed script và cron scheduleGenerator cùng tự sinh 1 ngày độc lập nhau.
            // KHÔNG tự đoán bản ghi nào "đúng" — hiển thị trung thực + cảnh báo, để riêng từng
            // bản ghi trong "Chi tiết" thay vì gộp/chọn đại 1 bản. Đây là vấn đề DATABASE, ghi
            // vào docs/doctor-schedule-database-gap-analysis.md, không tự sửa ở đây.
            const distinctScheduleIds = [...new Set(daySlots.map((s) => s.schedule_id))]
            const hasDataAnomaly = distinctScheduleIds.length > 1

            const dayStatus = !hasDataAnomaly ? (daySlots[0]?.trang_thai_ngay ?? null) : null
            // Không coalesce về null — cần phân biệt "không có lịch ngày này" (undefined, ẩn dòng y tá)
            // với "có lịch nhưng chưa phân công y tá" (null, hiện "Chưa phân công y tá"). Khi có
            // bất thường (nhiều document), không khẳng định 1 y tá duy nhất — ẩn dòng này.
            const nurseName = !hasDataAnomaly ? daySlots[0]?.nurse : undefined
            const timeStatus = isToday ? todayTimeStatus(daySlots) : null
            const scheduleId = !hasDataAnomaly ? (daySlots[0]?.schedule_id ?? null) : null

            return (
              <div key={date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* ── Header ngày — div chứa các nút anh em (không lồng button trong button) ── */}
                <div className="flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
                <button
                  type="button"
                  onClick={() => toggleDate(date)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isToday ? 'bg-brand-500 text-white' : isPastDay ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {date.split('-')[2]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{formatDayHeader(date)}</span>
                      {isToday && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                          Hôm nay
                        </span>
                      )}
                      {timeStatus && <Badge color={timeStatus.color}>{timeStatus.label}</Badge>}
                      {isPastDay && <Badge color="gray">Đã qua — chỉ xem</Badge>}
                      {dayStatus && dayStatus !== 'lam_viec' && (
                        <Badge color={SCHEDULE_DAY_STATUS_COLOR[dayStatus]}>{SCHEDULE_DAY_STATUS_LABEL[dayStatus]}</Badge>
                      )}
                      {hasDataAnomaly && (
                        <Badge color="red">⚠ {distinctScheduleIds.length} bản ghi trùng ngày — cần Admin kiểm tra</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <DaySummary slots={daySlots} />
                      <DotBar slots={daySlots} />
                      {nurseName !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Icon name="user" className="h-3 w-3" />
                          {nurseName ?? 'Chưa phân công y tá'}
                        </span>
                      )}
                    </div>
                  </div>

                  <Icon
                    name="chevron-down"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {scheduleId && (
                  <button
                    type="button"
                    onClick={() => setDetailScheduleId(scheduleId)}
                    className="hidden shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex"
                  >
                    <Icon name="file-text" className="h-3 w-3" /> Chi tiết
                  </button>
                )}
                {/* Bất thường (>1 bản ghi/ngày): không đoán bản ghi nào đúng — cho xem riêng
                    từng bản ghi thay vì gộp hoặc chọn đại 1 bản. */}
                {hasDataAnomaly && (
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {distinctScheduleIds.map((id, i) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDetailScheduleId(id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        <Icon name="file-text" className="h-3 w-3" /> Bản ghi {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                </div>

                {/* ── Danh sách slot ───────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {scheduleId && (
                      <button
                        type="button"
                        onClick={() => setDetailScheduleId(scheduleId)}
                        className="flex w-full items-center gap-1.5 px-5 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 sm:hidden"
                      >
                        <Icon name="file-text" className="h-3.5 w-3.5" /> Xem chi tiết ngày này
                      </button>
                    )}
                    {hasDataAnomaly && (
                      <div className="flex flex-wrap items-center gap-2 bg-red-50 px-5 py-2 sm:hidden">
                        <span className="text-xs font-medium text-red-600">⚠ {distinctScheduleIds.length} bản ghi trùng ngày:</span>
                        {distinctScheduleIds.map((id, i) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setDetailScheduleId(id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                          >
                            Bản ghi {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    {daySlots.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-400">Không có ca làm việc cho ngày này.</p>
                    ) : (['sang', 'chieu'] as const).map((ca) => {
                      // Ca sáng 08:00–11:30 / ca chiều 13:30–17:30 — xem .claude/rules/lich-lam-viec-bac-si.md §1
                      const caSlots = daySlots.filter((s) => (ca === 'sang' ? s.gio_bat_dau < '12:00' : s.gio_bat_dau >= '12:00'))
                      if (caSlots.length === 0) return null

                      return (
                        <div key={ca} className="px-5 py-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                            {ca === 'sang' ? 'Ca sáng' : 'Ca chiều'}
                          </p>

                          <div className="space-y-3">
                            {groupSlotsByKhung(caSlots).map((khung) => {
                              const conTrong = khung.slots.filter((s) => s.status === 'active').length

                              return (
                            <div key={`${khung.gio_bat_dau}-${khung.gio_ket_thuc}`}>
                              {/* Header khung giờ — chỉ hiện 1 lần dù khung có nhiều slot */}
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <Icon name="clock" className="h-4 w-4 text-brand-400" />
                                {khung.gio_bat_dau} – {khung.gio_ket_thuc}
                                <span className="text-xs font-normal text-slate-400">
                                  · còn trống {conTrong}/{khung.slots.length}
                                </span>
                              </div>

                              <div className="mt-2 space-y-2">
                                {khung.slots.map((slot) => {
                                  const coveringLeave = slot.status === 'active' ? findCoveringLeave(slot, leaves) : undefined
                                  const canRequestLeave = slot.status === 'active' && !isPastDay && !coveringLeave
                                  const loaiSlot = slot.loai_slot ?? 'online'

                                  return (
                                    <div key={slot.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50/70 px-3 py-2">
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

                                      {/* Badge trạng thái */}
                                      <Badge color={SCHEDULE_SLOT_STATUS_COLOR[slot.status]}>{STATUS_LABEL[slot.status]}</Badge>

                                      {/* Badge loại slot — online vs tại chỗ (walk-in) */}
                                      <Badge color={SLOT_LOAI_COLOR[loaiSlot]}>{SLOT_LOAI_LABEL[loaiSlot]}</Badge>

                                      {/* Đánh dấu slot thuộc bản ghi nào khi 1 ngày có >1 document (bất thường dữ liệu) */}
                                      {hasDataAnomaly && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                                          Bản ghi {distinctScheduleIds.indexOf(slot.schedule_id) + 1}
                                        </span>
                                      )}

                                      {/* Tên bệnh nhân */}
                                      {slot.benh_nhan && (
                                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                          <Icon name="user" className="h-3 w-3" />
                                          {slot.benh_nhan}
                                          {slot.la_khach_vang_lai && ' (khách vãng lai)'}
                                        </span>
                                      )}

                                      {/* Nút hành động — ẩn hoàn toàn với ngày đã qua (chỉ xem) */}
                                      {!isPastDay && (
                                        <div className="ml-auto flex items-center gap-2">
                                          {canRequestLeave && (
                                            <button
                                              onClick={() => setLeaveDialog({ slot, ly_do: '' })}
                                              className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100"
                                            >
                                              <Icon name="calendar" className="h-3 w-3" /> Gửi yêu cầu nghỉ
                                            </button>
                                          )}
                                          {coveringLeave && (
                                            <span className="inline-flex cursor-default items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-500">
                                              <Icon name="clock" className="h-3 w-3" /> {LEAVE_STATUS_LABEL[coveringLeave.trang_thai]}
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
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                              )
                            })}
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

      {/* ── Modal chi tiết ngày làm việc ──────────────────────────────────────── */}
      {detailScheduleId && (
        <ScheduleDetailModal scheduleId={detailScheduleId} onClose={() => setDetailScheduleId(null)} />
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
              Gửi yêu cầu không tự hủy lịch hẹn nào của bệnh nhân.
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
