import { useEffect, useState } from 'react'
import { appointmentService } from '@/services/appointment.service'
import type {
  AdminAppointmentDoctorOption,
  AdminAppointmentServiceOption,
} from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  onSaved: () => void
  onCancel: () => void
}

type AppointmentType = 'clinic' | 'home'

export default function AddAppointment({ onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    user_id: '',
    ten_khach: '',
    so_dien_thoai_khach: '',
    doctor_id: '',
    schedule_id: '',
    slot_id: '',
    service_id: '',
    loai_kham: 'clinic' as AppointmentType,
    dia_chi_kham: '',
    ly_do_kham: '',
  })

  const [doctors, setDoctors] = useState<AdminAppointmentDoctorOption[]>([])
  const [services, setServices] = useState<AdminAppointmentServiceOption[]>([])
  const [schedules, setSchedules] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    appointmentService.getActiveDoctors()
      .then(setDoctors)
      .catch(() => setError('Loi lay danh sach bac si'))
  }, [])

  useEffect(() => {
    appointmentService.getActiveServices(form.loai_kham)
      .then(setServices)
      .catch(() => setError('Loi lay danh sach dich vu'))
  }, [form.loai_kham])

  useEffect(() => {
    if (!form.doctor_id) {
      setSchedules([])
      return
    }

    appointmentService.getDoctorSchedules(form.doctor_id)
      .then(setSchedules)
      .catch(() => setError('Loi lay lich lam viec cua bac si'))
  }, [form.doctor_id])

  const selectedDoctor = doctors.find((doctor) => doctor._id === form.doctor_id)
  const availableServices = services.filter((service) =>
    !selectedDoctor || selectedDoctor.service_ids.includes(service._id)
  )
  const selectedService = availableServices.find((service) => service._id === form.service_id)
  const selectedSchedule = schedules.find((schedule) => schedule._id === form.schedule_id)

  useEffect(() => {
    if (form.service_id && !availableServices.some((service) => service._id === form.service_id)) {
      setForm((prev) => ({ ...prev, service_id: '' }))
    }
  }, [availableServices, form.service_id])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      schedule_id: '',
      slot_id: '',
    }))
  }, [form.doctor_id])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
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

    if (!form.user_id.trim()) {
      setError('Vui long nhap ID tai khoan benh nhan.')
      return
    }
    if (!form.ten_khach.trim()) {
      setError('Vui long nhap ten benh nhan.')
      return
    }
    if (!form.doctor_id || !form.service_id || !form.schedule_id || !form.slot_id) {
      setError('Vui long chon day du Bac si, Dich vu, Ngay kham va Khung gio.')
      return
    }
    if (form.loai_kham === 'home' && !form.dia_chi_kham.trim()) {
      setError('Kham tai nha yeu cau nhap dia chi.')
      return
    }

    setLoading(true)
    try {
      await appointmentService.create(form)
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Loi khi dat lich')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Dat lich kham ho</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            ID tai khoan benh nhan <span className="text-red-500">*</span>
          </label>
          <input
            name="user_id"
            value={form.user_id}
            onChange={handleChange}
            className="input w-full"
            placeholder="Vi du: 64fa..."
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Ten benh nhan <span className="text-red-500">*</span>
          </label>
          <input
            name="ten_khach"
            value={form.ten_khach}
            onChange={handleChange}
            className="input w-full"
            placeholder="Nguyen Van A"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">So dien thoai</label>
          <input
            name="so_dien_thoai_khach"
            value={form.so_dien_thoai_khach}
            onChange={handleChange}
            className="input w-full"
            placeholder="090..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Loai kham <span className="text-red-500">*</span>
          </label>
          <select
            name="loai_kham"
            value={form.loai_kham}
            onChange={handleChange}
            className="input w-full"
          >
            <option value="clinic">Tai phong kham</option>
            <option value="home">Tai nha</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Bac si phu trach <span className="text-red-500">*</span>
          </label>
          <select
            name="doctor_id"
            value={form.doctor_id}
            onChange={handleChange}
            className="input w-full"
            required
          >
            <option value="">-- Chon bac si --</option>
            {doctors.map((doctor) => (
              <option key={doctor._id} value={doctor._id}>
                {doctor.ten} ({doctor.chuyen_khoa})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Dich vu <span className="text-red-500">*</span>
          </label>
          <select
            name="service_id"
            value={form.service_id}
            onChange={handleChange}
            className="input w-full"
            required
            disabled={!form.doctor_id}
          >
            <option value="">-- Chon dich vu --</option>
            {availableServices.map((service) => (
              <option key={service._id} value={service._id}>
                {service.ten}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Ngay kham <span className="text-red-500">*</span>
          </label>
          <select
            name="schedule_id"
            value={form.schedule_id}
            onChange={handleScheduleChange}
            className="input w-full"
            required
            disabled={!form.doctor_id}
          >
            <option value="">-- Chon ngay kham --</option>
            {schedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.ngay}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Khung gio <span className="text-red-500">*</span>
          </label>
          <select
            name="slot_id"
            value={form.slot_id}
            onChange={handleChange}
            className="input w-full"
            required
            disabled={!form.schedule_id}
          >
            <option value="">-- Chon gio kham --</option>
            {selectedSchedule?.slots.map((slot: any) => (
              <option key={slot._id} value={slot._id}>
                {slot.gio_bat_dau} - {slot.gio_ket_thuc} (Con {slot.so_benh_nhan_toi_da - slot.so_benh_nhan_hien_tai} cho)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Gia kham</label>
          <input
            type="number"
            value={selectedService?.gia ?? 0}
            className="input w-full bg-slate-50"
            readOnly
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Ly do kham</label>
          <input
            name="ly_do_kham"
            value={form.ly_do_kham}
            onChange={handleChange}
            className="input w-full"
            placeholder="Nhap ly do kham"
          />
        </div>

        {form.loai_kham === 'home' && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Dia chi kham <span className="text-red-500">*</span>
            </label>
            <textarea
              name="dia_chi_kham"
              value={form.dia_chi_kham}
              onChange={handleChange}
              className="input w-full resize-none"
              rows={3}
            />
          </div>
        )}

        <div className="sm:col-span-2 mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary px-6">
            Huy
          </button>
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? 'Dang tao...' : 'Tao lich hen'}
          </button>
        </div>
      </form>
    </div>
  )
}
