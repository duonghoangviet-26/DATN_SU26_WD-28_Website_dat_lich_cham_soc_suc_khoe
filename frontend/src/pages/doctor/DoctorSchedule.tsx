import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Toast from '@/components/common/Toast'
import Modal from '@/components/common/Modal'
import Empty from '@/components/common/Empty'
import Icon from '@/components/admin/icons'
import ScheduleCalendarGrid, {
  formatFullDate,
  type ScheduleCalendarDay,
} from '@/components/common/ScheduleCalendarGrid'
import DayShiftBoard from '@/components/doctor/DayShiftBoard'
import { scheduleService } from '@/services/schedule.service'
import { doctorLeaveService } from '@/services/doctor-leave.service'
import type { DoctorSlot, DoctorLeaveRequest, DoctorScheduleDetail } from '@/types'
import { toLocalDateStr } from '@/utils/format'
import { parseLocalDate, getMondayOfWeek, addDays } from '@/utils/scheduleWeek'
import {
  SCHEDULE_DAY_STATUS_LABEL,
  SCHEDULE_DAY_STATUS_COLOR,
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  SLOT_LOAI_LABEL,
  SLOT_LOAI_COLOR,
} from '@/utils/constants'

const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function formatDayHeader(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return `${DAY_NAMES[d.getDay()]}  ·  ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function isAbortError(err: unknown): boolean {
  const e = err as { code?: string; name?: string } | null
  return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError'
}

function hhmmNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Ngày làm việc dựng từ slot ───────────────────────────────────────────────
// API bác sĩ (GET /doctor/schedule) trả về mảng slot phẳng, không có bản ghi cấp NGÀY như
// API admin. Gom lại theo ngày để dùng chung được lưới lịch với trang Admin.
interface DoctorWorkday extends ScheduleCalendarDay {
  slots: DoctorSlot[]
  scheduleIds: string[]
  ghi_chu_ngay: string | null
  phong_kham: string | null
}

function buildWorkdays(slots: DoctorSlot[], fromDate: string, toDate: string): DoctorWorkday[] {
  const slotsByDate = new Map<string, DoctorSlot[]>()
  slots.forEach((slot) => {
    const list = slotsByDate.get(slot.ngay)
    if (list) list.push(slot)
    else slotsByDate.set(slot.ngay, [slot])
  })

  const days: DoctorWorkday[] = []
  const cursor = parseLocalDate(fromDate)
  const end = parseLocalDate(toDate)
  while (cursor.getTime() <= end.getTime()) {
    const ngay = toLocalDateStr(cursor)
    const daySlots = (slotsByDate.get(ngay) ?? []).slice()
      .sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
    const phong = daySlots.find((s) => s.phong_kham)?.phong_kham ?? null

    days.push({
      ngay,
      // Ngày không có slot nào = admin chưa tạo lịch cho bác sĩ ngày đó (rule §3).
      trang_thai_ngay: daySlots.length === 0 ? 'chua_tao' : (daySlots[0].trang_thai_ngay ?? 'lam_viec'),
      slots: daySlots,
      scheduleIds: [...new Set(daySlots.map((s) => s.schedule_id))],
      ghi_chu_ngay: null,
      phong_kham: phong,
      tong_slot: daySlots.length,
      slot_da_dat: daySlots.filter((s) => s.status === 'booked').length,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// ─── Modal lịch hẹn & thanh toán của ngày ─────────────────────────────────────

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

  return (
    <Modal isOpen onClose={onClose} title="Lịch hẹn & thanh toán" size="xl">
      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error || !detail ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-600">Không tải được chi tiết ca. Vui lòng thử lại sau.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{formatDayHeader(detail.ngay)}</span>
            {detail.trang_thai_ngay && detail.trang_thai_ngay !== 'lam_viec' && (
              <Badge color={SCHEDULE_DAY_STATUS_COLOR[detail.trang_thai_ngay]}>
                {SCHEDULE_DAY_STATUS_LABEL[detail.trang_thai_ngay]}
              </Badge>
            )}
          </div>

          {detail.thong_ke.slot_trong > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {detail.thong_ke.slot_trong} chỗ còn trống
              <Badge color={SLOT_LOAI_COLOR.online}>{detail.thong_ke.slot_online_trong} {SLOT_LOAI_LABEL.online}</Badge>
              {detail.thong_ke.slot_walkin_trong > 0 && (
                <Badge color={SLOT_LOAI_COLOR.walk_in}>{detail.thong_ke.slot_walkin_trong} {SLOT_LOAI_LABEL.walk_in}</Badge>
              )}
            </div>
          )}

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
                    <span className="font-semibold tabular-nums text-slate-700">{a.gio_kham}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.benh_nhan}</span>
                    {a.la_khach_vang_lai && <Badge color="gray">Khách tại chỗ</Badge>}
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
                Mở Lịch hẹn của tôi
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

  // Khoảng ngày do lưới lịch điều khiển (tuần/tháng). Mặc định: tuần hiện tại T2–CN.
  const [range, setRange] = useState(() => {
    const monday = getMondayOfWeek(new Date())
    return { from: toLocalDateStr(monday), to: toLocalDateStr(addDays(monday, 6)) }
  })

  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Yêu cầu nghỉ thật của bác sĩ — đối chiếu với từng khung (GAP-5), không phụ thuộc state RAM.
  const [leaves, setLeaves] = useState<DoctorLeaveRequest[]>([])
  const loadLeaves = useCallback(() => {
    doctorLeaveService.list().then(setLeaves).catch(() => {})
  }, [])
  useEffect(() => { loadLeaves() }, [loadLeaves])

  // Ngày đang xem chi tiết — mặc định hôm nay, bảng ca luôn có nội dung ngay khi mở trang.
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const [detailScheduleId, setDetailScheduleId] = useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [leaveDialog, setLeaveDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    scheduleService
      .getAll({ from: range.from, to: range.to }, controller.signal)
      .then(setSlots)
      .catch((err) => { if (!isAbortError(err)) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [range.from, range.to, reloadKey])

  const workdays = useMemo(() => buildWorkdays(slots, range.from, range.to), [slots, range.from, range.to])
  const selectedDay = useMemo(
    () => workdays.find((d) => d.ngay === selectedDate) ?? null,
    [workdays, selectedDate],
  )

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
      loadLeaves() // tải lại danh sách thật — nút "Xin nghỉ" tự ẩn nhờ đối chiếu (GAP-5)
      showSuccess(
        created.so_lich_hen_anh_huong && created.so_lich_hen_anh_huong > 0
          ? `Đã gửi yêu cầu nghỉ tới Admin. Có ${created.so_lich_hen_anh_huong} lịch hẹn sẽ bị ảnh hưởng.`
          : 'Đã gửi yêu cầu nghỉ tới Admin. Chờ duyệt.'
      )
    } catch (err) { showError((err as Error).message) }
    finally { setLeaveSubmitting(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  // Bất thường dữ liệu THẬT: 1 ngày có thể có >1 document LichLamViec (schedule_id khác nhau)
  // — unique index {doctor_id, ngay} không bắt được vì 2 document có Date instant khác nhau dù
  // cùng ngày lịch. KHÔNG tự đoán bản ghi nào "đúng" — hiển thị trung thực để Admin xử lý.
  const hasDataAnomaly = (selectedDay?.scheduleIds.length ?? 0) > 1
  const isPastDay = selectedDay ? selectedDay.ngay < todayStr : false
  const chiXem = isPastDay || (selectedDay?.trang_thai_ngay !== 'lam_viec')

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="Lịch do hệ thống tự sinh — bạn xem ca và gửi yêu cầu nghỉ. Chọn một ngày để xem chi tiết bên dưới."
      />

      {actionError && (
        <Toast key={actionError} message={actionError} type="error" onClose={() => setActionError('')} />
      )}
      {actionSuccess && (
        <Toast key={actionSuccess} message={actionSuccess} type="success" onClose={() => setActionSuccess('')} />
      )}

      {error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được lịch làm việc. Vui lòng thử lại sau.</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>
        </div>
      ) : (
        <>
          <ScheduleCalendarGrid
            items={workdays}
            fromDate={range.from}
            toDate={range.to}
            loading={loading}
            subtitle="Chọn một ngày để xem chi tiết ca bên dưới."
            selectedDate={selectedDate}
            onRangeChange={(from, to) => setRange({ from, to })}
            onSelectDay={(day) => setSelectedDate(day.ngay)}
          />

          {hasDataAnomaly && selectedDay && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                Ngày này có {selectedDay.scheduleIds.length} bản ghi lịch làm việc trùng nhau — cần Admin kiểm tra.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedDay.scheduleIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailScheduleId(id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    <Icon name="file-text" className="h-3 w-3" /> Bản ghi {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDay && !loading && (
            <DayShiftBoard
              tieuDe={formatFullDate(selectedDay.ngay)}
              slots={selectedDay.slots}
              leaves={leaves}
              phongKham={selectedDay.phong_kham}
              gioHienTai={selectedDay.ngay === todayStr ? hhmmNow() : null}
              chiXem={chiXem}
              ghiChu={selectedDay.ghi_chu_ngay}
              onXinNghi={(slot) => setLeaveDialog({ slot, ly_do: '' })}
              onYeuCauHuy={(slot) => setCancelDialog({ slot, ly_do: '' })}
              onXemChiTiet={
                selectedDay.scheduleIds.length === 1
                  ? () => setDetailScheduleId(selectedDay.scheduleIds[0])
                  : undefined
              }
            />
          )}
        </>
      )}

      {detailScheduleId && (
        <ScheduleDetailModal scheduleId={detailScheduleId} onClose={() => setDetailScheduleId(null)} />
      )}

      {/* ── Dialog gửi yêu cầu nghỉ cho 1 khung ──────────────────────────────── */}
      {leaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Icon name="calendar" className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Xin nghỉ khung giờ</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {leaveDialog.slot.gio_bat_dau}–{leaveDialog.slot.gio_ket_thuc} · {formatDayHeader(leaveDialog.slot.ngay)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Yêu cầu gửi tới Admin duyệt. Khung chỉ chuyển sang "Tạm nghỉ" sau khi Admin đồng ý,
              và không có lịch hẹn nào của bệnh nhân bị hủy tự động.
            </div>

            <div className="mt-4">
              <label className="input-label">
                Lý do xin nghỉ <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                className="input mt-1 resize-none"
                placeholder="VD: Có việc đột xuất, xin nghỉ khung này..."
                value={leaveDialog.ly_do}
                onChange={(e) => setLeaveDialog({ ...leaveDialog, ly_do: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setLeaveDialog(null)} className="btn-secondary" disabled={leaveSubmitting}>
                Đóng
              </button>
              <button
                type="button"
                onClick={submitLeaveRequest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
                <Icon name="alert-circle" className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Yêu cầu hủy ca đã có bệnh nhân</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {cancelDialog.slot.gio_bat_dau}–{cancelDialog.slot.gio_ket_thuc} · Bệnh nhân:{' '}
                  <strong>{cancelDialog.slot.benh_nhan}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Yêu cầu gửi tới Admin. Admin liên hệ bệnh nhân và sắp xếp dời lịch.
            </div>

            <div className="mt-4">
              <label className="input-label">
                Lý do yêu cầu hủy <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                className="input mt-1 resize-none"
                placeholder="VD: Có việc đột xuất, xin hủy ca và sắp xếp lịch bổ sung..."
                value={cancelDialog.ly_do}
                onChange={(e) => setCancelDialog({ ...cancelDialog, ly_do: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setCancelDialog(null)} className="btn-secondary" disabled={cancelSubmitting}>
                Đóng
              </button>
              <button
                type="button"
                onClick={submitCancelRequest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
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
