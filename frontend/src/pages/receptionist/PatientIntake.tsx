import { FormEvent, useMemo, useState } from 'react'
import {
  CapacityEvidence,
  OfflineAvailability,
  PatientProfile,
  TodayAppointment,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

const emptyForm = {
  ho_ten: '',
  ngay_sinh: '',
  gioi_tinh: '' as '' | 'nam' | 'nu' | 'khac',
  ghi_chu: '',
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function paymentLabel(status: string) {
  return ({ paid: 'Đã thanh toán', partial: 'Thanh toán một phần', unpaid: 'Chưa thanh toán', refunded: 'Đã hoàn tiền' } as Record<string, string>)[status] ?? status
}

function appointmentStatusLabel(status: string) {
  return ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', checked_in: 'Đã tiếp nhận', in_progress: 'Đang khám', completed: 'Hoàn thành' } as Record<string, string>)[status] ?? status
}

function capacityLabel(row: CapacityEvidence) {
  return ({
    co_the_tiep_nhan: 'Có thể tiếp nhận',
    tam_dung_qua_tai: 'Tạm ngưng tiếp nhận',
    da_day_walk_in: 'Đã hết suất tiếp nhận',
    khong_co_lich_bac_si: 'Không có lịch bác sĩ',
    khong_co_khung_gan: 'Ngoài giờ tiếp nhận',
  } as Record<string, string>)[row.ket_luan] ?? row.ket_luan
}

function capacityTone(row: CapacityEvidence) {
  if (row.ket_luan === 'co_the_tiep_nhan') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (row.ket_luan === 'tam_dung_qua_tai') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function availabilityLabel(status: OfflineAvailability['trang_thai_kiem_tra']) {
  return ({
    co_the_tiep_nhan: 'Có thể tiếp nhận',
    tam_dung_qua_tai: 'Tạm ngưng tiếp nhận do ca khám đang trễ',
    da_day_walk_in: 'Đã hết suất tiếp nhận trong khung khám',
    khong_co_lich_bac_si: 'Không có lịch bác sĩ hợp lệ',
    khong_co_khung_gan: 'Hiện không trong giờ tiếp nhận',
  } as Record<string, string>)[status] ?? 'Chưa thể đánh giá khả năng tiếp nhận'
}

function availabilityTone(status: OfflineAvailability['trang_thai_kiem_tra']) {
  if (status === 'co_the_tiep_nhan') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (status === 'tam_dung_qua_tai') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-800'
}

function appointmentIsCheckinable(appointment: TodayAppointment) {
  return ['pending', 'confirmed'].includes(appointment.status)
}

export default function PatientIntake() {
  const [phone, setPhone] = useState('')
  const [profiles, setProfiles] = useState<PatientProfile[]>([])
  const [ambiguousAppointments, setAmbiguousAppointments] = useState<TodayAppointment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState<OfflineAvailability | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null
  const selectedAppointment = selectedProfile?.lich_hen_hom_nay.find((appointment) => appointment.id === selectedAppointmentId) ?? null
  const selectedSlot = availability?.slots.find((slot) => slot.slot_id === selectedSlotId) ?? null
  const hasAppointmentToday = Boolean(selectedProfile?.lich_hen_hom_nay.length)
  const hasActiveQueue = Boolean(selectedProfile?.luot_dang_cho_hom_nay)

  const capacitySummary = useMemo(() => {
    if (!availability) return null
    const rows = availability.minh_chung_suc_chua || []
    return {
      availableDoctors: rows.filter((row) => row.ket_luan === 'co_the_tiep_nhan').length,
      availableSlots: rows.reduce((total, row) => total + row.walk_in_con_lai, 0),
    }
  }, [availability])

  const clearDecision = () => {
    setAvailability(null)
    setSelectedSlotId(null)
    setSelectedAppointmentId(null)
  }

  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setMessage('')
    setSelectedId(null)
    setAmbiguousAppointments([])
    clearDecision()
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại để tra cứu')
      return
    }

    setLoading(true)
    try {
      const result = await receptionistPatientIntakeService.searchByPhone(phone)
      setProfiles(result.profiles)
      setAmbiguousAppointments(result.ambiguous_appointments || [])
      setMessage(result.total ? `Tìm thấy ${result.total} hồ sơ. Hãy xác nhận đúng người bệnh trước khi tiếp nhận.` : 'Chưa có hồ sơ, có thể tạo mới tại quầy.')
    } catch (requestError: any) {
      setProfiles([])
      setError(requestError?.response?.data?.message || 'Không thể tra cứu hồ sơ')
    } finally {
      setLoading(false)
    }
  }

  const selectProfile = (profile: PatientProfile) => {
    setSelectedId(profile.id)
    setError('')
    setMessage('')
    clearDecision()
  }

  const createProfile = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại ở bước “Tra cứu hôm nay” trước khi tạo hồ sơ mới.')
      return
    }
    setSaving(true)
    try {
      const profile = await receptionistPatientIntakeService.createProfile({
        ho_ten: form.ho_ten,
        // Dùng lại số đã tra cứu — không bắt lễ tân nhập lại cùng một thông tin.
        so_dien_thoai: phone.trim(),
        ngay_sinh: form.ngay_sinh || undefined,
        gioi_tinh: form.gioi_tinh || undefined,
        ghi_chu: form.ghi_chu || undefined,
      })
      const normalizedProfile: PatientProfile = { ...profile, lich_hen_hom_nay: [] }
      setProfiles((current) => [...current, normalizedProfile])
      setSelectedId(normalizedProfile.id)
      setPhone(normalizedProfile.so_dien_thoai || phone)
      setForm(emptyForm)
      setMessage('Đã tạo hồ sơ. Vì người bệnh chưa có lịch hẹn, hãy kiểm tra khả năng tiếp nhận trước khi xếp hàng chờ khám.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo hồ sơ bệnh nhân')
    } finally {
      setSaving(false)
    }
  }

  const loadAvailability = async () => {
    setError('')
    setMessage('')
    setAvailability(null)
    setSelectedSlotId(null)
    try {
      const result = await receptionistPatientIntakeService.getAvailability()
      setAvailability(result)
      setSelectedSlotId(result.slot_de_xuat?.slot_id || result.slots[0]?.slot_id || null)
      if (!result.slots.length) setMessage(result.thong_bao || 'Hiện chưa thể tiếp nhận người bệnh chưa có lịch hẹn')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể xác minh sức chứa. Chưa thể kết luận phòng khám đã hết chỗ.')
    }
  }

  const checkInBooked = async () => {
    if (!selectedAppointment || !selectedProfile) return
    setCheckingIn(true)
    setError('')
    try {
      const response = await receptionistPatientIntakeService.checkInAppointment(selectedAppointment.id)
      const warnings = response.data?.canh_bao || []
      setMessage(`Đã ghi nhận người bệnh đến khám theo lịch hẹn ${selectedAppointment.ma_lich_hen || selectedAppointment.id}. ${warnings.length ? `Lưu ý: ${warnings.join(' ')}` : 'Người bệnh đã được đưa vào hàng đợi của bác sĩ.'}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: response.data.hang_doi.id, trang_thai: 'dang_cho', doctor_id: response.data.hang_doi.doctor_id, phong_kham: response.data.hang_doi.phong_kham, checkin_time: response.data.hang_doi.checkin_time } }
        : profile))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể ghi nhận người bệnh đến khám. Vui lòng tải lại dữ liệu.')
    } finally {
      setCheckingIn(false)
    }
  }

  const checkInWalkIn = async () => {
    if (!selectedProfile || !selectedSlot) return
    setCheckingIn(true)
    setError('')
    try {
      const result = await receptionistPatientIntakeService.checkIn({
        ho_so_benh_nhan_id: selectedProfile.id,
        schedule_id: selectedSlot.schedule_id,
        slot_id: selectedSlot.slot_id,
      })
      setAvailability(null)
      setSelectedSlotId(null)
      setMessage(`Đã tiếp nhận ${selectedProfile.ho_ten} vào hàng đợi khám. Mã lượt: ${result.entry._id}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: result.entry._id, trang_thai: 'dang_cho', doctor_id: String(result.slot.doctor_id), phong_kham: result.slot.phong_kham, checkin_time: new Date().toISOString() } }
        : profile))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khả năng tiếp nhận vừa thay đổi. Vui lòng kiểm tra lại lịch làm việc và suất khám còn trống.')
      const isConflict = requestError?.response?.status === 409
      await loadAvailability()
      if (isConflict) {
        setError('Dữ liệu vừa thay đổi. Thông tin đã được tải lại; hãy chọn khung khám còn hiệu lực.')
      }
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Tiếp đón người bệnh · Có lịch hẹn và chưa có lịch hẹn</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-800">Tiếp nhận tại quầy</h2>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Tra cứu để xác định đúng người bệnh và lịch hẹn. Người bệnh có lịch hẹn được đưa vào hàng đợi của bác sĩ đã phân công; người bệnh chưa có lịch hẹn chỉ được tiếp nhận khi còn khả năng phục vụ.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">1. Nhận diện người bệnh</h3>
              <p className="mt-1 text-sm text-slate-500">Số điện thoại chỉ là khóa liên hệ, không phải định danh duy nhất.</p>
            </div>
            {profiles.length > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{profiles.length} hồ sơ</span>}
          </div>

          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={search}>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại người liên hệ" inputMode="tel" className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            <button type="submit" disabled={loading} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Đang tìm...' : 'Tra cứu hôm nay'}
            </button>
          </form>

          {message && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

          {ambiguousAppointments.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Có lịch hẹn hôm nay nhưng chưa xác định được thuộc hồ sơ nào.</p>
              <p className="mt-1">Không tự gắn lịch theo số điện thoại dùng chung. Hãy xác minh bằng mã lịch hẹn, họ tên và ngày sinh.</p>
              <div className="mt-3 space-y-2">
                {ambiguousAppointments.map((appointment) => <p key={appointment.id} className="rounded-lg bg-white/70 px-3 py-2">{appointment.ma_lich_hen || appointment.id} · {appointment.gio_kham} · {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</p>)}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {profiles.map((profile) => (
              <button key={profile.id} type="button" onClick={() => selectProfile(profile)} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === profile.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{profile.ho_ten}</p>
                    <p className="mt-1 text-sm text-slate-500">Ngày sinh: {formatDate(profile.ngay_sinh)} · {profile.gioi_tinh || 'Chưa rõ giới tính'}</p>
                    <p className="mt-1 text-xs text-slate-500">{profile.nguoi_lien_he?.ho_ten ? `Người liên hệ: ${profile.nguoi_lien_he.ho_ten}` : profile.member_id ? 'Thành viên gia đình' : 'Hồ sơ tại quầy'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${profile.lich_hen_hom_nay.length ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                      {profile.lich_hen_hom_nay.length ? `${profile.lich_hen_hom_nay.length} lịch hôm nay` : 'Chưa có lịch'}
                    </span>
                    {profile.luot_dang_cho_hom_nay && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Đang ở hàng đợi</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedProfile && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Đã xác nhận hồ sơ</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{selectedProfile.ho_ten}</p>
                <p className="mt-1 text-sm text-slate-600">Ngày sinh: {formatDate(selectedProfile.ngay_sinh)} · Số liên hệ: {selectedProfile.so_dien_thoai || phone}</p>
                {hasActiveQueue && <p className="mt-3 text-sm font-semibold text-amber-800">Hồ sơ này đã có lượt đang xử lý hôm nay tại {selectedProfile.luot_dang_cho_hom_nay?.phong_kham || 'phòng khám'}.</p>}
              </div>

              {selectedProfile.lich_hen_hom_nay.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">2A. Lịch hẹn đã đặt</h4>
                      <p className="mt-1 text-sm text-slate-500">Chọn đúng lịch hẹn để ghi nhận người bệnh đến khám. Không cần kiểm tra khung khám còn trống.</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">ĐÃ ĐẶT TRƯỚC</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedProfile.lich_hen_hom_nay.map((appointment) => (
                      <button key={appointment.id} type="button" onClick={() => setSelectedAppointmentId(appointment.id)} className={`w-full rounded-xl border p-3 text-left ${selectedAppointmentId === appointment.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800">{appointment.gio_kham} · {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</p>
                            <p className="mt-1 text-xs text-slate-500">{appointment.ma_lich_hen || appointment.id} · {appointment.chuyen_khoa?.ten || 'Chưa có chuyên khoa'} · {appointment.phong_kham || 'Chưa có phòng'}</p>
                          </div>
                          <span className="text-right text-xs text-slate-600">{appointmentStatusLabel(appointment.status)}<br />{paymentLabel(appointment.payment_status)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedAppointment && (
                    <button type="button" onClick={checkInBooked} disabled={checkingIn || hasActiveQueue || !appointmentIsCheckinable(selectedAppointment)} className="mt-3 min-h-11 w-full rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                      {hasActiveQueue ? 'Hồ sơ đã có lượt trong hàng đợi' : !appointmentIsCheckinable(selectedAppointment) ? `Chưa thể tiếp nhận ở trạng thái ${appointmentStatusLabel(selectedAppointment.status)}` : checkingIn ? 'Đang ghi nhận người bệnh đến khám...' : `Xác nhận người bệnh đến khám ${selectedAppointment.ma_lich_hen || ''}`}
                    </button>
                  )}
                </div>
              )}

              {!hasAppointmentToday && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">2B. Người bệnh chưa có lịch hẹn</h4>
                      <p className="mt-1 text-sm text-slate-500">Chỉ tiếp nhận sau khi hệ thống xác nhận bác sĩ còn khả năng phục vụ.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">CHƯA CÓ LỊCH HẸN</span>
                  </div>
                  <button type="button" onClick={loadAvailability} disabled={hasActiveQueue} className="mt-4 min-h-11 w-full rounded-xl border border-brand-300 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60">
                    {availability ? 'Kiểm tra lại khả năng tiếp nhận' : 'Kiểm tra khả năng tiếp nhận'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedProfile && !hasAppointmentToday ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">3. Đánh giá khả năng tiếp nhận</h3>
                  <p className="mt-1 text-sm text-slate-500">Căn cứ lịch làm việc của bác sĩ, suất khám đã sử dụng, hàng đợi và độ trễ thực tế.</p>
                </div>
                {availability && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Cập nhật {formatDateTime(availability.checked_at)}</span>}
              </div>

              {!availability && <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">Chưa đánh giá khả năng tiếp nhận. Bấm “Kiểm tra khả năng tiếp nhận” để xem thông tin trước khi xếp hàng chờ khám.</div>}

              {availability && (
                <>
                  <div className={`mt-5 rounded-xl border p-4 ${availabilityTone(availability.trang_thai_kiem_tra)}`}>
                    <p className="font-semibold">{availability.trang_thai_kiem_tra === 'co_the_tiep_nhan' ? `${availabilityLabel(availability.trang_thai_kiem_tra)} · còn ${capacitySummary?.availableSlots || 0} suất tiếp nhận` : availabilityLabel(availability.trang_thai_kiem_tra)}</p>
                    {availability.thong_bao && availability.trang_thai_kiem_tra !== 'co_the_tiep_nhan' && <p className="mt-1 text-sm">{availability.thong_bao}</p>}
                    <p className="mt-1 text-xs opacity-80">Phạm vi: khung khám đang phục vụ · Kiểm tra lúc {formatDateTime(availability.checked_at)}</p>
                  </div>

                  {availability.slot_de_xuat && (
                    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
                      <p className="font-semibold">Phương án tiếp nhận đề xuất</p>
                      <p className="mt-1 font-medium">Bác sĩ {availability.minh_chung_suc_chua.find((row) => row.doctor_id === availability.slot_de_xuat?.doctor_id)?.bac_si || 'đang trực'} · {availability.slot_de_xuat.gio_bat_dau}–{availability.slot_de_xuat.gio_ket_thuc} · {availability.slot_de_xuat.phong_kham || 'chưa có phòng'}</p>
                      <p className="mt-1 text-xs text-brand-800">{availability.ly_do_de_xuat}</p>
                    </div>
                  )}

                  {availability.minh_chung_suc_chua?.length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr><th className="px-3 py-3 font-semibold">Bác sĩ / khung khám</th><th className="px-3 py-3 font-semibold">Có lịch hẹn</th><th className="px-3 py-3 font-semibold">Chưa có lịch hẹn</th><th className="px-3 py-3 font-semibold">Hàng đợi</th><th className="px-3 py-3 font-semibold">Đánh giá</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {availability.minh_chung_suc_chua.map((row) => <tr key={`${row.schedule_id}-${row.doctor_id}`}>
                            <td className="px-3 py-3"><p className="font-semibold text-slate-800">{row.bac_si}</p><p className="mt-1 text-slate-500">{row.khung_gan_nhat ? `${row.khung_gan_nhat.gio_bat_dau}–${row.khung_gan_nhat.gio_ket_thuc}` : 'Không có khung gần'}</p></td>
                            <td className="px-3 py-3 text-slate-700">{row.online_da_dat}/{row.tong_slot_trong_khung}</td>
                            <td className="px-3 py-3"><span className="font-semibold text-slate-800">{row.walk_in_con_lai}</span><span className="text-slate-500">/{row.walk_in_tong}</span></td>
                            <td className="px-3 py-3 text-slate-700">{row.dang_cho} {row.do_tre_phut > 0 ? `(+${row.do_tre_phut}')` : ''}</td>
                            <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 font-semibold ${capacityTone(row)}`}>{capacityLabel(row)}</span><p className="mt-1 max-w-48 text-slate-500">{row.ly_do}</p></td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Không tìm thấy lịch làm việc của bác sĩ hôm nay. Đây là trạng thái “không có lịch”, không phải tình trạng “hết suất khám”.</div>}

                  {availability.goi_y_quay_lai && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Thời điểm có thể tiếp nhận trở lại: <strong>{availability.goi_y_quay_lai.gio_bat_dau}–{availability.goi_y_quay_lai.gio_ket_thuc}</strong>. Hệ thống sẽ kiểm tra lại khi người bệnh quay lại.</p>}

                  {availability.slots.length > 0 && !hasActiveQueue && (
                    <>
                      <h4 className="mt-5 font-semibold text-slate-800">Chọn khung khám còn chỗ</h4>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {availability.slots.map((slot) => <button key={slot.slot_id} type="button" onClick={() => setSelectedSlotId(slot.slot_id)} className={`rounded-xl border p-3 text-left ${selectedSlotId === slot.slot_id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300'}`}><p className="font-semibold text-slate-800">{slot.gio_bat_dau}–{slot.gio_ket_thuc}</p><p className="mt-1 text-xs text-slate-500">{slot.phong_kham || 'Phòng sẽ được điều phối'} · Bác sĩ {availability.minh_chung_suc_chua.find((row) => row.doctor_id === slot.doctor_id)?.bac_si || 'đang trực'}</p></button>)}
                      </div>
                      {selectedSlot && <button type="button" onClick={checkInWalkIn} disabled={checkingIn} className="mt-4 min-h-11 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">{checkingIn ? 'Đang giữ suất khám và tạo lượt...' : `Xác nhận tiếp nhận ${selectedProfile.ho_ten}`}</button>}
                    </>
                  )}
                </>
              )}
            </>
          ) : selectedProfile && hasAppointmentToday ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900"><p className="font-semibold">Người bệnh đã có lịch hẹn.</p><p className="mt-1">Hãy chọn lịch hẹn ở cột bên trái để ghi nhận đến khám. Không cần kiểm tra khả năng tiếp nhận.</p></div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">Chọn đúng hồ sơ để bắt đầu quy trình tiếp nhận phù hợp.</div>
          )}
        </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h3 className="text-base font-bold text-slate-800">Tạo hồ sơ mới</h3><p className="mt-1 text-sm text-slate-500">Chỉ dùng khi người bệnh chưa có hồ sơ. Số điện thoại trùng không đồng nghĩa là cùng một người.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Không tạo lịch hẹn</span>
          </div>
          <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={createProfile}>
            <label className="text-sm font-medium text-slate-700">Họ tên *<input required value={form.ho_ten} onChange={(event) => setForm({ ...form, ho_ten: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></label>
            <div className="text-sm font-medium text-slate-700">Số liên hệ đã tra cứu<div className={`mt-1.5 flex min-h-11 items-center rounded-xl border px-3 text-sm ${phone ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{phone || 'Chưa nhập số điện thoại ở bước tra cứu'}</div><p className="mt-1 text-xs font-normal text-slate-500">Hệ thống sẽ tự dùng số này cho hồ sơ mới.</p></div>
            <label className="text-sm font-medium text-slate-700">Ngày sinh<input type="date" value={form.ngay_sinh} onChange={(event) => setForm({ ...form, ngay_sinh: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></label>
            <label className="text-sm font-medium text-slate-700">Giới tính<select value={form.gioi_tinh} onChange={(event) => setForm({ ...form, gioi_tinh: event.target.value as typeof form.gioi_tinh })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"><option value="">Chưa cập nhật</option><option value="nam">Nam</option><option value="nu">Nữ</option><option value="khac">Khác</option></select></label>
            <button type="submit" disabled={saving} className="min-h-11 self-end rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Đang lưu...' : 'Tạo hồ sơ'}</button>
          </form>
        </section>
      </div>
    </div>
  )
}
