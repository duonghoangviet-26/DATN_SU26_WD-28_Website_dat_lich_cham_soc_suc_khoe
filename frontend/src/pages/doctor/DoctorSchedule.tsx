import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { scheduleService } from '@/services/schedule.service'
import type { DoctorSlot } from '@/types'
import { formatDate } from '@/utils/format'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const SLOT_STATUS_COLOR: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  active: 'green', booked: 'blue', locked: 'yellow', cancelled: 'red', expired: 'gray',
}
const SLOT_STATUS_LABEL: Record<string, string> = {
  active: 'Còn trống', booked: 'Đã có lịch', locked: 'Bác sĩ bận',
  cancelled: 'Đã hủy', expired: 'Hết hạn',
}

const TIME_OPTIONS = [
  '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00',
]

const EMPTY_FORM = {
  ngay: '', gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNext14Days() {
  const dates: string[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function canModify(slot: DoctorSlot, todayStr: string) {
  return slot.ngay >= todayStr && slot.status !== 'booked' && slot.status !== 'cancelled' && slot.status !== 'expired'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorSchedule() {
  const todayStr = new Date().toISOString().slice(0, 10)

  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    scheduleService.getAll().then(setSlots).finally(() => setLoading(false))
  }, [])

  const slotsByDate = slots.reduce<Record<string, DoctorSlot[]>>((acc, s) => {
    if (!acc[s.ngay]) acc[s.ngay] = []
    acc[s.ngay].push(s)
    return acc
  }, {})

  const next14 = getNext14Days()
  const datesWithSlots = [
    ...new Set([...next14.filter((d) => slotsByDate[d]), ...Object.keys(slotsByDate)]),
  ].sort()

  function openModal() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (form.gio_bat_dau >= form.gio_ket_thuc) {
      setFormError('Giờ bắt đầu phải trước giờ kết thúc.')
      return
    }
    setSaving(true)
    try {
      const newSlot = await scheduleService.addSlot({
        ngay: form.ngay,
        gio_bat_dau: form.gio_bat_dau,
        gio_ket_thuc: form.gio_ket_thuc,
        phong_kham: form.phong_kham.trim() || null,
      })
      setSlots((prev) => [...prev, newSlot])
      setShowModal(false)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLock(id: number) {
    try {
      const updated = await scheduleService.lockSlot(id)
      setSlots((prev) => prev.map((s) => s.id === id ? updated : s))
    } catch (err) {
      setActionError((err as Error).message)
      setTimeout(() => setActionError(''), 3000)
    }
  }

  async function handleUnlock(id: number) {
    const updated = await scheduleService.unlockSlot(id)
    setSlots((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  async function handleDelete(id: number) {
    try {
      await scheduleService.deleteSlot(id)
      setSlots((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setActionError((err as Error).message)
      setTimeout(() => setActionError(''), 3000)
    }
  }

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="Quản lý ca làm việc của bạn trong 14 ngày tới."
      >
        <button onClick={openModal} className="btn-primary flex items-center gap-1.5">
          <Icon name="plus" className="h-4 w-4" /> Thêm ca mới
        </button>
      </PageHeader>

      {/* Lỗi action */}
      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : datesWithSlots.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Icon name="calendar" className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Chưa có ca làm việc nào. Thêm ca đầu tiên của bạn!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {datesWithSlots.map((date) => {
            const daySlots = (slotsByDate[date] ?? []).sort(
              (a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau),
            )
            const isToday = date === todayStr
            const isPast  = date < todayStr

            return (
              <div key={date} className={`card overflow-hidden ${isPast ? 'opacity-60' : ''}`}>
                {/* Header ngày */}
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isToday ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {new Date(date + 'T00:00:00').getDate()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{formatDate(date)}</span>
                    {isToday && (
                      <span className="ml-2 text-xs font-semibold text-brand-600">Hôm nay</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-slate-400">{daySlots.length} ca</span>
                </div>

                {/* Danh sách slot */}
                <div className="divide-y divide-slate-100">
                  {daySlots.map((slot) => (
                    <div key={slot.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      {/* Giờ */}
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Icon name="clock" className="h-4 w-4 text-brand-400" />
                        {slot.gio_bat_dau} – {slot.gio_ket_thuc}
                      </div>

                      {/* Phòng / cảnh báo */}
                      {slot.phong_kham ? (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Icon name="hospital" className="h-3.5 w-3.5" />
                          {slot.phong_kham}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-500">⚠ Chưa có phòng</span>
                      )}

                      {/* Badge trạng thái */}
                      <Badge color={SLOT_STATUS_COLOR[slot.status]}>
                        {SLOT_STATUS_LABEL[slot.status]}
                      </Badge>

                      {/* Tên bệnh nhân nếu booked */}
                      {slot.benh_nhan && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          <Icon name="user" className="h-3 w-3" />
                          {slot.benh_nhan}
                        </span>
                      )}

                      {/* Nút thao tác — chỉ hiện với slot có thể sửa */}
                      {canModify(slot, todayStr) && (
                        <div className="ml-auto flex items-center gap-2">
                          {slot.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleLock(slot.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 transition-colors hover:bg-yellow-100"
                              >
                                <Icon name="lock" className="h-3 w-3" /> Khóa
                              </button>
                              {slot.benh_nhan_id == null && (
                                <button
                                  onClick={() => handleDelete(slot.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                >
                                  <Icon name="trash" className="h-3 w-3" /> Xóa
                                </button>
                              )}
                            </>
                          )}
                          {slot.status === 'locked' && (
                            <button
                              onClick={() => handleUnlock(slot.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100"
                            >
                              <Icon name="check" className="h-3 w-3" /> Bỏ khóa
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal thêm ca mới */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Thêm ca làm việc mới</h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="input-label">Ngày làm việc</label>
                <input
                  type="date"
                  className="input"
                  required
                  min={todayStr}
                  value={form.ngay}
                  onChange={(e) => setForm({ ...form, ngay: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Giờ bắt đầu</label>
                  <select
                    className="input"
                    value={form.gio_bat_dau}
                    onChange={(e) => setForm({ ...form, gio_bat_dau: e.target.value })}
                  >
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Giờ kết thúc</label>
                  <select
                    className="input"
                    value={form.gio_ket_thuc}
                    onChange={(e) => setForm({ ...form, gio_ket_thuc: e.target.value })}
                  >
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Phòng khám</label>
                <input
                  type="text"
                  className="input"
                  placeholder="VD: Phòng 201, Tầng 2, Tòa A"
                  value={form.phong_kham}
                  onChange={(e) => setForm({ ...form, phong_kham: e.target.value })}
                />
                {!form.phong_kham.trim() && (
                  <p className="mt-1 text-xs text-amber-500">
                    ⚠ Nếu chưa điền phòng, bệnh nhân sẽ chưa thể đặt lịch vào ca này.
                  </p>
                )}
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Thêm ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
