import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Badge from '@/components/common/Badge'
import PageHeader from '@/components/common/PageHeader'
import { adminDoctorScheduleService } from '@/services/admin-doctor-schedule.service'
import { appointmentService } from '@/services/appointment.service'
import type {
  AdminAppointmentDoctorOption,
  AdminDoctorScheduleDetail,
  AdminDoctorScheduleSlot,
  AdminDoctorWorkdayItem,
} from '@/types'

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

const SLOT_STATUS_OPTIONS: AdminDoctorScheduleSlot['status'][] = [
  'active',
  'locked',
  'cancelled',
  'expired',
  'pending_payment',
  'booked',
]

function getDefaultRange() {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + 13)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
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
  const [workingCopy, setWorkingCopy] = useState<AdminDoctorScheduleDetail | null>(schedule)
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWorkingCopy(schedule)
    setError(null)
    setSavingSlotId(null)
  }, [schedule])

  if (!workingCopy) return null

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
        slots: current.slots.map((slot) =>
          slot._id === slotId ? { ...slot, [field]: value } : slot
        ),
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Chỉnh lịch làm việc bác sĩ</h3>
            <p className="mt-1 text-sm text-slate-500">
              Ngày {workingCopy.ngay} • {workingCopy.slots.length} slot
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary">Đóng</button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
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
              {workingCopy.slots.map((slot) => {
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
                        className="input w-full"
                        disabled={immutableStatus}
                      >
                        {SLOT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
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

  const summary = {
    total: items.length,
    working: items.filter((item) => item.trang_thai_ngay === 'lam_viec').length,
    dayOff: items.filter((item) => item.trang_thai_ngay === 'nghi').length,
    leave: items.filter((item) => item.trang_thai_ngay === 'nghi_phep').length,
    missing: items.filter((item) => item.trang_thai_ngay === 'chua_tao').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch làm việc bác sĩ"
        description="Theo dõi lịch đi làm thường ngày của bác sĩ, kể cả khi chưa có bệnh nhân đặt lịch. Admin có thể sinh lịch tự động cho ngày trống và chỉnh trực tiếp các slot của bác sĩ."
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
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Đến ngày</label>
            <input
              type="date"
              className="input w-full"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-medium text-slate-700">Bác sĩ đang xem</div>
            <div className="mt-1">{doctorName || 'Chưa chọn bác sĩ'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: 'Tổng ngày', value: summary.total, color: 'text-slate-700' },
          { label: 'Đi làm', value: summary.working, color: 'text-green-600' },
          { label: 'Nghỉ', value: summary.dayOff, color: 'text-slate-500' },
          { label: 'Nghỉ phép', value: summary.leave, color: 'text-amber-600' },
          { label: 'Chưa tạo lịch', value: summary.missing, color: 'text-red-600' },
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
        Ngày có trạng thái `Chưa tạo lịch` nghĩa là hiện chưa có document lịch làm việc cho ngày đó. Admin có thể bấm `Sinh lịch tự động` để tạo luôn lịch mặc định cho ngày trống, sau đó mở `Chỉnh slot` để sửa giờ/phòng/trạng thái từng khung khám.
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-800">{item.ngay}</h3>
                    <Badge color={STATUS_COLOR[item.trang_thai_ngay]}>
                      {STATUS_LABEL[item.trang_thai_ngay]}
                    </Badge>
                    {item.nguon_lich === 'derived' && <Badge color="gray">Suy diễn</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.gio_bat_dau && item.gio_ket_thuc
                      ? `Khung giờ làm việc: ${item.gio_bat_dau} - ${item.gio_ket_thuc}`
                      : 'Chưa có khung giờ làm việc'}
                  </p>
                  {item.ghi_chu_ngay && (
                    <p className="mt-1 text-sm text-slate-500">Ghi chú: {item.ghi_chu_ngay}</p>
                  )}
                </div>

                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:min-w-[360px]">
                  <div>Tổng slot: <span className="font-semibold text-slate-800">{item.tong_slot}</span></div>
                  <div>Slot trống: <span className="font-semibold text-green-700">{item.slot_trong}</span></div>
                  <div>Đã đặt: <span className="font-semibold text-blue-700">{item.slot_da_dat}</span></div>
                  <div>Bị khóa / hủy: <span className="font-semibold text-slate-700">{item.slot_bi_khoa + item.slot_da_huy}</span></div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!item._id ? (
                  <button
                    type="button"
                    onClick={() => createScheduleForDay(item)}
                    disabled={savingId === item.ngay || item.trang_thai_ngay === 'nghi'}
                    className="btn-primary disabled:opacity-50"
                  >
                    {savingId === item.ngay ? 'Đang sinh...' : 'Sinh lịch tự động'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openScheduleEditor(item._id!)}
                      className="btn-primary"
                    >
                      Chỉnh slot
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
        }}
      />
    </div>
  )
}
