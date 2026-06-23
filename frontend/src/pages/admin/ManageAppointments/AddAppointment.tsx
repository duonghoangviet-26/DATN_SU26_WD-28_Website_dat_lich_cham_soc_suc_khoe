import { useState, useEffect } from 'react'
import { appointmentService } from '@/services/appointment.service'
import Icon from '@/components/admin/icons'

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
    service_id: '',
    loai_kham: 'clinic',
    ngay_kham: '',
    gio_kham: '',
    gia_kham: 0,
    dia_chi_kham: '',
  })
  
  const [doctors, setDoctors] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    appointmentService.getActiveDoctors().then(setDoctors).catch(() => setError('Lỗi lấy danh sách bác sĩ'))
  }, [])

  useEffect(() => {
    if (form.doctor_id) {
      appointmentService.getDoctorSchedules(form.doctor_id).then(setSchedules)
      const selectedDoctor = doctors.find(d => d._id === form.doctor_id)
      setForm(prev => ({ 
        ...prev, 
        schedule_id: '', slot_id: '', ngay_kham: '', gio_kham: '',
        gia_kham: selectedDoctor ? selectedDoctor.gia_kham : 0
      }))
    } else {
      setSchedules([])
    }
  }, [form.doctor_id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleScheduleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const schedId = e.target.value
    const sched = schedules.find(s => s._id === schedId)
    setForm(prev => ({ 
      ...prev, 
      schedule_id: schedId, 
      slot_id: '', 
      ngay_kham: sched ? sched.ngay : '',
      gio_kham: ''
    }))
  }

  function handleSlotChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const slotId = e.target.value
    const sched = schedules.find(s => s._id === form.schedule_id)
    const slot = sched?.slots?.find((sl: any) => sl._id === slotId)
    setForm(prev => ({
      ...prev,
      slot_id: slotId,
      gio_kham: slot ? slot.gio_bat_dau : ''
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    if (!form.doctor_id || !form.schedule_id || !form.slot_id) {
      setError('Vui lòng chọn Bác sĩ, Ngày khám và Giờ khám.')
      return
    }
    if (form.loai_kham === 'home' && !form.dia_chi_kham) {
      setError('Khám tại nhà yêu cầu nhập địa chỉ.')
      return
    }
    if (!form.user_id && !form.ten_khach) {
      setError('Nếu không chọn bệnh nhân có tài khoản, vui lòng nhập tên khách.')
      return
    }

    setLoading(true)
    try {
      await appointmentService.create(form)
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Lỗi khi đặt lịch')
    } finally {
      setLoading(false)
    }
  }

  const selectedSchedule = schedules.find(s => s._id === form.schedule_id)

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Đặt lịch khám hộ</h3>
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
        {/* Thông tin bệnh nhân */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Tên khách hàng</label>
          <input name="ten_khach" value={form.ten_khach} onChange={handleChange} className="input w-full" placeholder="Nguyễn Văn A" required={!form.user_id} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Số điện thoại</label>
          <input name="so_dien_thoai_khach" value={form.so_dien_thoai_khach} onChange={handleChange} className="input w-full" placeholder="090..." />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">ID Tài khoản (tùy chọn, nếu có)</label>
          <input name="user_id" value={form.user_id} onChange={handleChange} className="input w-full" placeholder="Ví dụ: 64fa..." />
        </div>

        {/* Thông tin bác sĩ & dịch vụ */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Bác sĩ phụ trách <span className="text-red-500">*</span></label>
          <select name="doctor_id" value={form.doctor_id} onChange={handleChange} className="input w-full" required>
            <option value="">-- Chọn bác sĩ --</option>
            {doctors.map(d => (
              <option key={d._id} value={d._id}>{d.ten} ({d.chuyen_khoa})</option>
            ))}
          </select>
        </div>

        {/* Lịch làm việc & Slot */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Ngày khám <span className="text-red-500">*</span></label>
          <select name="schedule_id" value={form.schedule_id} onChange={handleScheduleChange} className="input w-full" required disabled={!form.doctor_id}>
            <option value="">-- Chọn ngày khám --</option>
            {schedules.map(s => (
              <option key={s._id} value={s._id}>{s.ngay}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Khung giờ <span className="text-red-500">*</span></label>
          <select name="slot_id" value={form.slot_id} onChange={handleSlotChange} className="input w-full" required disabled={!form.schedule_id}>
            <option value="">-- Chọn giờ khám --</option>
            {selectedSchedule?.slots.map((sl: any) => (
              <option key={sl._id} value={sl._id}>{sl.gio_bat_dau} - {sl.gio_ket_thuc} (Còn {sl.so_benh_nhan_toi_da - sl.so_benh_nhan_hien_tai} chỗ)</option>
            ))}
          </select>
        </div>

        {/* Thời gian & Địa điểm */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Loại khám <span className="text-red-500">*</span></label>
          <select name="loai_kham" value={form.loai_kham} onChange={handleChange} className="input w-full">
            <option value="clinic">Tại phòng khám</option>
            <option value="home">Tại nhà</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Giá khám dự kiến</label>
          <input type="number" name="gia_kham" value={form.gia_kham} onChange={handleChange} className="input w-full" />
        </div>
        
        {form.loai_kham === 'home' && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Địa chỉ (bắt buộc khi khám tại nhà)</label>
            <input name="dia_chi_kham" value={form.dia_chi_kham} onChange={handleChange} className="input w-full" />
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-3 mt-4">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary px-6">Hủy</button>
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? 'Đang tạo...' : 'Tạo lịch hẹn'}
          </button>
        </div>
      </form>
    </div>
  )
}
