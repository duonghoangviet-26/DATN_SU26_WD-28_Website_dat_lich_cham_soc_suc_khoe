import { useEffect, useState, useMemo } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Toast from '@/components/common/Toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { scheduleService } from '@/services/schedule.service'
import { mockRooms } from '@/mock/rooms'
import type { DoctorSlot } from '@/types'
import { toLocalDateStr } from '@/utils/format'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  active: 'green', booked: 'blue', locked: 'yellow', cancelled: 'red', expired: 'gray',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Còn trống', booked: 'Đã đặt', locked: 'Tạm nghỉ',
  cancelled: 'Đã hủy', expired: 'Hết hạn',
}
const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DAY_NAMES[dow]}  ·  ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// So cả ngày lẫn giờ — slot hôm nay đã trôi qua giờ bắt đầu cũng phải coi là hết hạn,
// tránh hiển thị "Còn trống" cho 1 ca 08:00 khi đã là 15:00 chiều cùng ngày.
function effectiveStatus(slot: DoctorSlot, todayStr: string, nowStr: string): DoctorSlot['status'] {
  if (slot.status !== 'active' && slot.status !== 'locked') return slot.status
  if (slot.ngay < todayStr) return 'expired'
  if (slot.ngay === todayStr && slot.gio_bat_dau <= nowStr) return 'expired'
  return slot.status
}

// Tìm các phòng đang bị chiếm bởi slot khác trong cùng ngày + trùng giờ
function getBusyRoomNames(targetSlot: DoctorSlot, allSlots: DoctorSlot[]): Set<string> {
  const busy = new Set<string>()
  allSlots.forEach((s) => {
    if (s.id === targetSlot.id) return
    if (s.ngay !== targetSlot.ngay) return
    if (!s.phong_kham) return
    if (s.status === 'cancelled' || s.status === 'expired') return
    // Kiểm tra trùng giờ
    if (s.gio_bat_dau < targetSlot.gio_ket_thuc && s.gio_ket_thuc > targetSlot.gio_bat_dau) {
      busy.add(s.phong_kham)
    }
  })
  return busy
}

// ─── Sub: Thanh chấm trạng thái slot theo ngày ────────────────────────────────

function DotBar({ slots, todayStr, nowStr }: { slots: DoctorSlot[]; todayStr: string; nowStr: string }) {
  const dotColor = (s: DoctorSlot) => {
    const eff = effectiveStatus(s, todayStr, nowStr)
    if (eff === 'booked') return 'bg-blue-400'
    if (eff === 'locked') return 'bg-yellow-400'
    if (eff === 'cancelled' || eff === 'expired') return 'bg-slate-200'
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

function DaySummary({ slots, todayStr, nowStr }: { slots: DoctorSlot[]; todayStr: string; nowStr: string }) {
  const booked = slots.filter((s) => s.status === 'booked').length
  const locked = slots.filter((s) => s.status === 'locked').length
  const active = slots.filter((s) => effectiveStatus(s, todayStr, nowStr) === 'active').length
  const parts: string[] = []
  if (active > 0) parts.push(`${active} trống`)
  if (booked > 0) parts.push(`${booked} đặt`)
  if (locked > 0) parts.push(`${locked} bận`)
  return <span className="text-xs text-slate-400">{parts.join(' · ') || '—'}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorSchedule() {
  const todayStr = toLocalDateStr()
  const nowStr = nowHHMM()

  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([todayStr]))
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Modal chọn phòng
  const [roomPickerSlot, setRoomPickerSlot] = useState<DoctorSlot | null>(null)
  const [savingRoom, setSavingRoom] = useState(false)

  // Dialog yêu cầu hủy
  const [cancelDialog, setCancelDialog] = useState<{ slot: DoctorSlot; ly_do: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Dialog nghỉ cả ngày
  const [dayOffDate, setDayOffDate] = useState<string | null>(null)
  const [dayOffSubmitting, setDayOffSubmitting] = useState(false)

  useEffect(() => {
    scheduleService.getAll().then(setSlots).finally(() => setLoading(false))
  }, [])

  // Nhóm slot theo ngày và sắp xếp
  const slotsByDate = useMemo(() => {
    const map: Record<string, DoctorSlot[]> = {}
    slots.forEach((s) => {
      if (!map[s.ngay]) map[s.ngay] = []
      map[s.ngay].push(s)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau)))
    return map
  }, [slots])

  const orderedDates = useMemo(
    () => Object.keys(slotsByDate).sort(),
    [slotsByDate],
  )

  // Danh sách phòng bận cho slot đang được picker mở
  const busyRoomNames = useMemo(
    () => (roomPickerSlot ? getBusyRoomNames(roomPickerSlot, slots) : new Set<string>()),
    [roomPickerSlot, slots],
  )

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

  async function handleLock(slot: DoctorSlot) {
    try {
      const updated = await scheduleService.lockSlot(slot.id)
      setSlots((prev) => prev.map((s) => s.id === slot.id ? updated : s))
      showSuccess('Đã đặt ca Tạm nghỉ.')
    } catch (err) { showError((err as Error).message) }
  }

  async function handleUnlock(slot: DoctorSlot) {
    try {
      const updated = await scheduleService.unlockSlot(slot.id)
      setSlots((prev) => prev.map((s) => s.id === slot.id ? updated : s))
      showSuccess('Đã mở lại ca làm việc.')
    } catch (err) { showError((err as Error).message) }
  }

  async function selectRoom(slot: DoctorSlot, fullName: string | null) {
    setSavingRoom(true)
    try {
      const updated = await scheduleService.updatePhongKham(slot.id, fullName)
      setSlots((prev) => prev.map((s) => s.id === slot.id ? updated : s))
      // Cập nhật roomPickerSlot để UI phản ánh ngay phòng vừa chọn
      setRoomPickerSlot((prev) => prev ? { ...prev, phong_kham: fullName } : null)
      showSuccess(fullName ? `Đã chọn ${fullName}.` : 'Đã xóa phòng khám.')
      if (!fullName) setRoomPickerSlot(null)
    } catch (err) { showError((err as Error).message) }
    finally { setSavingRoom(false) }
  }

  async function confirmDayOff() {
    if (!dayOffDate) return
    setDayOffSubmitting(true)
    try {
      const { locked } = await scheduleService.lockDay(dayOffDate)
      setSlots((prev) => prev.map((s) =>
        s.ngay === dayOffDate && s.status === 'active' ? { ...s, status: 'locked' } : s
      ))
      showSuccess(`Đã đặt nghỉ ${locked} ca trống trong ngày.`)
    } catch (err) { showError((err as Error).message) }
    finally { setDayOffSubmitting(false); setDayOffDate(null) }
  }

  async function submitCancelRequest() {
    if (!cancelDialog) return
    if (!cancelDialog.ly_do.trim()) {
      showError('Vui lòng nhập lý do trước khi gửi.')
      return
    }
    setCancelSubmitting(true)
    try {
      const targetId = cancelDialog.slot.id
      await scheduleService.requestCancelSlot(targetId, cancelDialog.ly_do)
      setSlots((prev) => prev.map((s) => s.id === targetId ? { ...s, cancel_requested: true } : s))
      setCancelDialog(null)
      showSuccess('Đã gửi yêu cầu hủy ca tới Admin. Chờ xử lý.')
    } catch (err) { showError((err as Error).message) }
    finally { setCancelSubmitting(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="6 ngày làm việc tiếp theo (Thứ 2–Thứ 7). Hệ thống tự sinh đầy đủ slot — bạn chỉ cần đánh dấu Tạm nghỉ khi bận."
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
      ) : orderedDates.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Chưa có lịch làm việc. Liên hệ Admin để thiết lập.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orderedDates.map((date) => {
            const daySlots = slotsByDate[date]
            const isToday = date === todayStr
            const isExpanded = expandedDates.has(date)
            const activeCount = daySlots.filter((s) => effectiveStatus(s, todayStr, nowStr) === 'active').length

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
                      <DaySummary slots={daySlots} todayStr={todayStr} nowStr={nowStr} />
                      <DotBar slots={daySlots} todayStr={todayStr} nowStr={nowStr} />
                    </div>
                  </div>

                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDayOffDate(date) }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100"
                    >
                      <Icon name="ban" className="h-3 w-3" /> Nghỉ cả ngày
                    </button>
                  )}

                  <Icon
                    name="chevron-down"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* ── Danh sách slot ───────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {daySlots.map((slot) => {
                      const eff = effectiveStatus(slot, todayStr, nowStr)
                      // Dùng eff (trạng thái đã tính giờ/ngày), không dùng slot.status thô —
                      // nếu không, ca đã qua ngày/giờ (status vẫn 'active'/'locked' trong data)
                      // vẫn cho bấm Tạm nghỉ/Mở lại/sửa phòng dù thực tế đã hết hạn.
                      const canEditRoom =
                        slot.benh_nhan_id == null &&
                        (eff === 'active' || eff === 'locked')

                      return (
                        <div key={slot.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                          {/* Giờ */}
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
                            {canEditRoom && (
                              <button
                                onClick={() => setRoomPickerSlot(slot)}
                                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-slate-300 hover:text-slate-500"
                                title="Chọn phòng"
                              >
                                <Icon name="edit" className="h-3 w-3" />
                              </button>
                            )}
                          </span>

                          {/* Badge trạng thái */}
                          <Badge color={STATUS_COLOR[eff]}>{STATUS_LABEL[eff]}</Badge>

                          {/* Tên bệnh nhân */}
                          {slot.benh_nhan && (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              <Icon name="user" className="h-3 w-3" />
                              {slot.benh_nhan}
                            </span>
                          )}

                          {/* Nút hành động */}
                          <div className="ml-auto flex items-center gap-2">
                            {eff === 'active' && (
                              <button
                                onClick={() => handleLock(slot)}
                                className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-100"
                              >
                                <Icon name="ban" className="h-3 w-3" /> Tạm nghỉ
                              </button>
                            )}
                            {eff === 'locked' && (
                              <button
                                onClick={() => handleUnlock(slot)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                <Icon name="check" className="h-3 w-3" /> Mở lại
                              </button>
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

      {/* ── Modal chọn phòng khám ─────────────────────────────────────────────── */}
      {roomPickerSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-800">Chọn phòng khám</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ca {roomPickerSlot.gio_bat_dau}–{roomPickerSlot.gio_ket_thuc}
                  {' · '}{formatDayHeader(roomPickerSlot.ngay)}
                </p>
              </div>
              <button onClick={() => setRoomPickerSlot(null)} className="btn-icon -mt-0.5">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            {/* Bảng phòng */}
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="py-2.5 pl-6 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Phòng
                    </th>
                    <th className="py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Loại phòng
                    </th>
                    <th className="py-2.5 pr-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tình trạng
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mockRooms.map((room) => {
                    const isBusy = busyRoomNames.has(room.full_name)
                    const isCurrent = roomPickerSlot.phong_kham === room.full_name

                    return (
                      <tr
                        key={room.id}
                        onClick={() => !isBusy && !savingRoom && selectRoom(roomPickerSlot, room.full_name)}
                        className={`transition-colors ${
                          isBusy
                            ? 'cursor-not-allowed bg-slate-50 opacity-40'
                            : isCurrent
                            ? 'cursor-pointer bg-brand-50'
                            : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 pl-6">
                          <div className="font-semibold text-slate-800">{room.ten}</div>
                          <div className="text-xs text-slate-400">Tầng {room.tang}, Tòa {room.toa}</div>
                        </td>
                        <td className="py-3 text-xs text-slate-500">{room.loai}</td>
                        <td className="py-3 pr-6 text-center">
                          {isBusy ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              🔒 Đang bận
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                              ✓ Đang chọn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              ✓ Còn trống
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
              <button
                onClick={() => selectRoom(roomPickerSlot, null)}
                disabled={savingRoom || !roomPickerSlot.phong_kham}
                className="text-xs text-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Xóa phòng khám
              </button>
              <button
                onClick={() => setRoomPickerSlot(null)}
                className="btn-secondary text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog xác nhận nghỉ cả ngày ─────────────────────────────────────── */}
      <ConfirmDialog
        open={dayOffDate !== null}
        title="Nghỉ cả ngày"
        message={dayOffDate ? `Toàn bộ ca "Còn trống" trong ${formatDayHeader(dayOffDate)} sẽ chuyển sang "Tạm nghỉ". Ca đã có bệnh nhân đặt không bị ảnh hưởng.` : ''}
        confirmText={dayOffSubmitting ? 'Đang xử lý...' : 'Xác nhận nghỉ'}
        danger
        onConfirm={confirmDayOff}
        onCancel={() => setDayOffDate(null)}
      />

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
