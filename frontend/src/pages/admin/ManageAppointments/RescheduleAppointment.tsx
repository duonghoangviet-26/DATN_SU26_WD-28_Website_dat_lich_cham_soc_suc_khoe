import { useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import type { AdminAppointmentDoctorOption, AppointmentItem } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  appointment: AppointmentItem
  onSaved: () => void
  onCancel: () => void
}

export default function RescheduleAppointment({ appointment, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    doctor_id: '',
    schedule_id: '',
    slot_id: '',
  })

  const [doctors, setDoctors] = useState<AdminAppointmentDoctorOption[]>([])
  const [schedules, setSchedules] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    appointmentService.getActiveDoctors()
      .then(setDoctors)
      .catch(() => setError('Lỗi lấy danh sách bác sĩ'))
  }, [])

  useEffect(() => {
    if (!form.doctor_id) {
      setSchedules([])
      return
    }

    appointmentService.getDoctorSchedules(form.doctor_id)
      .then(setSchedules)
      .catch(() => setError('Lỗi lấy lịch làm việc của bác sĩ'))
  }, [form.doctor_id])

  const selectedSchedule = schedules.find((schedule) => schedule._id === form.schedule_id)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleScheduleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const scheduleId = e.target.value
    setForm((prev) => ({
      ...prev,
      schedule_id: scheduleId,
      slot_id: '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.doctor_id || !form.schedule_id || !form.slot_id) {
      setError('Vui lòng chọn Bác sĩ, Ngày khám và Khung giờ mới.')
      return
    }

    setLoading(true)
    try {
      await appointmentService.reschedule(appointment._id, form)
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Lỗi khi dời lịch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Dời lịch khám</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-1 text-sm text-slate-600">
          Đang dời lịch cho bệnh nhân: <strong className="text-slate-800">{appointment.benh_nhan}</strong>
        </p>
        <p className="text-sm text-slate-600">
          Lịch cũ: <strong className="text-slate-800">{appointment.gio_kham} ngày {appointment.ngay_kham} ({appointment.bac_si})</strong>
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Bác sĩ mới (hoặc giữ nguyên) <span className="text-red-500">*</span>
          </label>
          <select
            name="doctor_id"
            value={form.doctor_id}
            onChange={handleChange}
            className="input w-full"
            required
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Ngày khám mới <span className="text-red-500">*</span>
          </label>
          <select
            name="schedule_id"
            value={form.schedule_id}
            onChange={handleScheduleChange}
            className="input w-full"
            required
            disabled={!form.doctor_id}
          >
            <option value="">-- Chọn ngày khám --</option>
            {schedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.ngay}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Khung giờ mới <span className="text-red-500">*</span>
          </label>
          <select
            name="slot_id"
            value={form.slot_id}
            onChange={handleChange}
            className="input w-full"
            required
            disabled={!form.schedule_id}
          >
            <option value="">-- Chọn giờ khám --</option>
            {selectedSchedule?.slots.map((slot: any) => (
              <option key={slot._id} value={slot._id}>
                {slot.gio_bat_dau} - {slot.gio_ket_thuc} (Còn {slot.so_benh_nhan_toi_da - slot.so_benh_nhan_hien_tai} chỗ)
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary px-6">
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary bg-blue-600 px-6 hover:bg-blue-700">
            {loading ? 'Đang dời...' : 'Xác nhận dời lịch'}
          </button>
        </div>
      </form>
    </div>
  )
}
