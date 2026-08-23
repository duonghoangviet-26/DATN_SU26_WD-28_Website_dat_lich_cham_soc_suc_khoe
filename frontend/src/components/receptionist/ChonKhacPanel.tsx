import { useEffect, useState } from 'react'
import { receptionistBookingService, type DoctorFilterOption } from '@/services/receptionist-booking.service'
import {
  receptionistRescheduleApprovalsService,
  type FreeSlot,
} from '@/services/receptionist-reschedule-approvals.service'

interface Props {
  appointmentId: string
  defaultDate: string
  onClose: () => void
  onDone: () => void
}

// Panel "Chọn khác" — chọn tay TỰ DO bác sĩ/ngày/slot ngoài danh sách gợi ý (mục 15, chốt
// 2026-08-22). Tái dùng luồng "chọn bác sĩ → chọn ngày → chọn slot trống" của DoctorDayView.
export default function ChonKhacPanel({ appointmentId, defaultDate, onClose, onDone }: Props) {
  const [doctors, setDoctors] = useState<DoctorFilterOption[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [slots, setSlots] = useState<FreeSlot[]>([])
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    receptionistBookingService.listDoctorsForFilter().then(setDoctors).catch(() => {})
  }, [])

  useEffect(() => {
    if (!doctorId || !date) {
      setSlots([])
      setScheduleId(null)
      return
    }
    let cancelled = false
    setLoadingSlots(true)
    setError('')
    receptionistRescheduleApprovalsService.freeSlots(appointmentId, doctorId, date)
      .then((res) => {
        if (cancelled) return
        setScheduleId(res.schedule_id)
        setSlots(res.slots)
      })
      .catch((requestError) => {
        if (cancelled) return
        setError(requestError?.response?.data?.message || 'Không thể tải danh sách slot trống.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => { cancelled = true }
  }, [appointmentId, doctorId, date])

  const chon = async (slotId: string) => {
    if (!doctorId || !scheduleId) return
    setSubmitting(true)
    setError('')
    try {
      await receptionistRescheduleApprovalsService.chonTay(appointmentId, {
        doctor_id: doctorId,
        schedule_id: scheduleId,
        slot_id: slotId,
      })
      onDone()
      onClose()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể dời lịch sang slot này.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
        <h3 className="text-lg font-bold text-slate-800">Chọn khác — tự chọn bác sĩ/ngày/giờ</h3>
        <p className="mt-1 text-xs text-slate-500">Dùng khi khách có yêu cầu riêng, ngoài danh sách đề xuất tự động. Chỉ hiện slot còn trống, cùng chuyên khoa, cách hiện tại ít nhất 15 phút.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Bác sĩ
            <select
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">-- Chọn bác sĩ --</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.ho_ten}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ngày
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <div className="mt-4">
          {!doctorId ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">Chọn bác sĩ để xem slot trống.</p>
          ) : loadingSlots ? (
            <p className="text-sm text-slate-400">Đang tải slot trống...</p>
          ) : slots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">Không có slot trống phù hợp trong ngày này.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.slot_id}
                  type="button"
                  disabled={submitting}
                  onClick={() => void chon(slot.slot_id)}
                  className="min-h-10 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {slot.gio_bat_dau}{slot.loai_slot === 'walk_in' ? ' (lấn walk-in)' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button>
        </div>
      </div>
    </div>
  )
}
