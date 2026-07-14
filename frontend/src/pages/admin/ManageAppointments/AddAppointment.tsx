import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import { appointmentService } from '@/services/appointment.service'
import type { AdminAppointmentDoctorOption } from '@/types'

function formatScheduleDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface Props {
  onSaved: () => void
  onCancel: () => void
}

export default function AddAppointment({ onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    user_id: '',
    ten_khach: '',
    so_dien_thoai_khach: '',
    doctor_id: '',
    schedule_id: '',
    slot_id: '',
    loai_kham: 'clinic' as const,
    ly_do_kham: '',
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

  const selectedDoctor = doctors.find((doctor) => doctor._id === form.doctor_id)
  const selectedSchedule = schedules.find((schedule) => schedule._id === form.schedule_id)

  useEffect(() => {
    setForm((current) => ({
      ...current,
      schedule_id: '',
      slot_id: '',
    }))
  }, [form.doctor_id])

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleScheduleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const scheduleId = event.target.value
    setForm((current) => ({
      ...current,
      schedule_id: scheduleId,
      slot_id: '',
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.ten_khach.trim()) {
      setError('Vui lòng nhập tên bệnh nhân.')
      return
    }

    if (!form.doctor_id || !form.schedule_id || !form.slot_id) {
      setError('Vui lòng chọn đầy đủ Bác sĩ, Ngày khám và Khung giờ.')
      return
    }

    setLoading(true)
    try {
      await appointmentService.create({
        ...form,
        service_id: undefined,
      })
      onSaved()
    } catch (error: any) {
      setError(error?.response?.data?.message || error.message || 'Lỗi khi đặt lịch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Đặt lịch hộ</h3>
          <p className="mt-1 text-sm text-slate-500">
            Giao diện hiện chỉ cho phép tạo lịch khám tại phòng khám.
          </p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Tùy chọn khám tại nhà đã được tạm ẩn khỏi UI admin. Nếu hệ thống còn dữ liệu lịch cũ kiểu
        này, chúng vẫn được giữ nguyên để xem lịch sử, nhưng form mới chỉ tạo lịch khám tại phòng khám.
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tên bệnh nhân <span className="text-red-500">*</span>
          </label>
          <input
            name="ten_khach"
            value={form.ten_khach}
            onChange={handleChange}
            className="input w-full"
            placeholder="Nguyễn Văn A"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Số điện thoại</label>
          <input
            name="so_dien_thoai_khach"
            value={form.so_dien_thoai_khach}
            onChange={handleChange}
            className="input w-full"
            placeholder="090..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Loại khám</label>
          <input
            value="Tại phòng khám"
            className="input w-full bg-slate-50"
            readOnly
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Bác sĩ phụ trách <span className="text-red-500">*</span>
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
            Ngày khám <span className="text-red-500">*</span>
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
                {formatScheduleDate(schedule.ngay)}
              </option>
            ))}
          </select>
          {form.doctor_id && schedules.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Bác sĩ này chưa có lịch làm việc từ hôm nay trở đi, hoặc tất cả khung giờ đã đầy.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Khung giờ <span className="text-red-500">*</span>
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
                {slot.gio_bat_dau} - {slot.gio_ket_thuc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Giá khám</label>
          <input
            type="number"
            value={selectedDoctor?.phi_kham ?? 0}
            className="input w-full bg-slate-50"
            readOnly
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Lý do khám</label>
          <input
            name="ly_do_kham"
            value={form.ly_do_kham}
            onChange={handleChange}
            className="input w-full"
            placeholder="Nhập lý do khám"
          />
        </div>

        <div className="mt-4 flex justify-end gap-3 sm:col-span-2">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary px-6">
            Hủy
          </button>
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? 'Đang tạo...' : 'Tạo lịch hẹn'}
          </button>
        </div>
      </form>
    </div>
  )
}
