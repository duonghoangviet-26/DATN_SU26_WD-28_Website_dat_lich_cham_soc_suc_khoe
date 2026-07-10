import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import { appointmentService } from '@/services/appointment.service'
import type { AdminAppointmentDoctorOption, AppointmentItem } from '@/types'

interface Props {
  appointment: AppointmentItem
  onSaved: () => void
  onCancel: () => void
}

export default function RescheduleAppointment({ appointment, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    doctor_id: appointment.doctor_id || '',
    schedule_id: '',
    slot_id: '',
    ly_do: '',
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

  function handleChange(
    event: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleScheduleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const scheduleId = event.target.value
    setForm((prev) => ({
      ...prev,
      schedule_id: scheduleId,
      slot_id: '',
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.doctor_id || !form.schedule_id || !form.slot_id) {
      setError('Vui lòng chọn Bác sĩ, Ngày khám và Khung giờ mới.')
      return
    }

    if (!form.ly_do.trim()) {
      setError('Vui lòng nhập lý do dời lịch.')
      return
    }

    setLoading(true)
    try {
      await appointmentService.reschedule(appointment._id, {
        ...form,
        ly_do: form.ly_do.trim(),
        updatedAt: appointment.ngay_cap_nhat,
      })
      onSaved()
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Lỗi khi dời lịch')
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
        {(appointment.so_lan_thay_doi ?? 0) >= 2 && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Lịch này đã bị dời nhiều lần, cần kiểm tra kỹ trước khi thao tác tiếp.
          </p>
        )}
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
            disabled={loading}
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
            disabled={!form.doctor_id || loading}
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
            disabled={!form.schedule_id || loading}
          >
            <option value="">-- Chọn giờ khám --</option>
            {selectedSchedule?.slots.map((slot: any) => (
              <option key={slot._id} value={slot._id}>
                {slot.gio_bat_dau} - {slot.gio_ket_thuc}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Lý do dời lịch <span className="text-red-500">*</span>
          </label>
          <textarea
            name="ly_do"
            rows={4}
            value={form.ly_do}
            onChange={handleChange}
            className="input w-full resize-none"
            placeholder="Nhập lý do dời lịch để lưu vào lịch sử thao tác..."
            disabled={loading}
          />
        </div>

        <div className="mt-4 flex justify-end gap-3 sm:col-span-2">
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
