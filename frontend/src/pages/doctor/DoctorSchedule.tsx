import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { scheduleService } from '@/services/schedule.service'
import type { DoctorSlot } from '@/types'
import { formatDate } from '@/utils/format'

const SLOT_STATUS_COLOR: Record<string, 'green' | 'yellow' | 'gray'> = {
  active: 'green', locked: 'yellow', cancelled: 'gray',
}
const SLOT_STATUS_LABEL: Record<string, string> = {
  active: 'Đang mở', locked: 'Khóa', cancelled: 'Đã hủy',
}

const TIME_OPTIONS = [
  '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00',
]

const DEFAULT_FORM = {
  ngay: '', gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 5,
}

function getNext14Days() {
  const dates: string[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export default function DoctorSchedule() {
  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    scheduleService.getAll().then(setSlots).finally(() => setLoading(false))
  }, [])

  const slotsByDate = slots.reduce<Record<string, DoctorSlot[]>>((acc, s) => {
    if (!acc[s.ngay]) acc[s.ngay] = []
    acc[s.ngay].push(s)
    return acc
  }, {})

  const next14 = getNext14Days()
  const datesWithSlots = [...new Set([...next14.filter((d) => slotsByDate[d]), ...Object.keys(slotsByDate)])].sort()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.gio_bat_dau >= form.gio_ket_thuc) {
      setError('Giờ bắt đầu phải trước giờ kết thúc.')
      return
    }
    setSaving(true)
    try {
      const newSlot = await scheduleService.addSlot({
        ngay: form.ngay,
        gio_bat_dau: form.gio_bat_dau,
        gio_ket_thuc: form.gio_ket_thuc,
        so_benh_nhan_toi_da: form.so_benh_nhan_toi_da,
      })
      setSlots((prev) => [...prev, newSlot])
      setShowModal(false)
      setForm(DEFAULT_FORM)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: number) {
    const updated = await scheduleService.cancelSlot(id)
    setSlots((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  async function handleDelete(id: number) {
    try {
      await scheduleService.deleteSlot(id)
      setSlots((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <PageHeader
        title="Lịch làm việc"
        description="Quản lý ca làm việc của bạn trong 14 ngày tới."
      >
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Icon name="plus" className="h-4 w-4" /> Thêm ca mới
        </button>
      </PageHeader>

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
            const daySlots = (slotsByDate[date] || []).sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
            const isToday = date === todayStr
            const isPast = date < todayStr
            return (
              <div key={date} className={`card overflow-hidden ${isPast ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isToday ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {new Date(date).getDate()}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{formatDate(date)}</span>
                    {isToday && <span className="ml-2 text-xs font-semibold text-brand-600">Hôm nay</span>}
                  </div>
                  <span className="ml-auto text-xs text-slate-400">{daySlots.length} ca</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {daySlots.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-400">Không có ca nào trong ngày này.</p>
                  ) : (
                    daySlots.map((slot) => (
                      <div key={slot.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Icon name="clock" className="h-4 w-4 text-brand-400" />
                          {slot.gio_bat_dau} – {slot.gio_ket_thuc}
                        </div>

                        {/* Patient count bar */}
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${slot.so_benh_nhan_hien_tai >= slot.so_benh_nhan_toi_da ? 'bg-red-400' : 'bg-green-400'}`}
                              style={{ width: `${Math.min(100, (slot.so_benh_nhan_hien_tai / slot.so_benh_nhan_toi_da) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {slot.so_benh_nhan_hien_tai}/{slot.so_benh_nhan_toi_da} bệnh nhân
                          </span>
                        </div>

                        <Badge color={SLOT_STATUS_COLOR[slot.status]}>{SLOT_STATUS_LABEL[slot.status]}</Badge>

                        <div className="ml-auto flex items-center gap-2">
                          {slot.status === 'active' && !isPast && (
                            <>
                              {slot.so_benh_nhan_hien_tai === 0 && (
                                <button
                                  onClick={() => handleDelete(slot.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                >
                                  <Icon name="trash" className="h-3 w-3" /> Xóa
                                </button>
                              )}
                              <button
                                onClick={() => handleCancel(slot.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100"
                              >
                                <Icon name="x" className="h-3 w-3" /> Hủy ca
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add slot modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Thêm ca làm việc mới</h2>
              <button onClick={() => { setShowModal(false); setError('') }} className="btn-icon">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="input-label">Ngày làm việc</label>
                <input type="date" className="input" required
                  min={todayStr}
                  value={form.ngay}
                  onChange={(e) => setForm({ ...form, ngay: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Giờ bắt đầu</label>
                  <select className="input" value={form.gio_bat_dau} onChange={(e) => setForm({ ...form, gio_bat_dau: e.target.value })}>
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Giờ kết thúc</label>
                  <select className="input" value={form.gio_ket_thuc} onChange={(e) => setForm({ ...form, gio_ket_thuc: e.target.value })}>
                    {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Số bệnh nhân tối đa</label>
                <input type="number" min={1} max={20} className="input"
                  value={form.so_benh_nhan_toi_da}
                  onChange={(e) => setForm({ ...form, so_benh_nhan_toi_da: Number(e.target.value) })}
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => { setShowModal(false); setError('') }} className="btn-secondary">Hủy</button>
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
