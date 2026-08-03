import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CapacityEvidence,
  OfflineAvailability,
  OnlineAccount,
  PatientProfile,
  TodayAppointment,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'
import ProfileAdminEditModal from '@/components/receptionist/ProfileAdminEditModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'
import QueueTicketTemplate, { QueueTicketData } from '@/components/receptionist/QueueTicketTemplate'

const emptyForm = {
  ho_ten: '',
  ngay_sinh: '',
  gioi_tinh: '' as '' | 'nam' | 'nu' | 'khac',
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleDateString('vi-VN')
}

function calcAge(value?: string | null) {
  if (!value) return null
  const birth = new Date(value)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  return age
}

function genderLabel(value?: string | null) {
  return ({ nam: 'Nam', nu: 'Nữ', khac: 'Khác' } as Record<string, string>)[value ?? ''] ?? 'Chưa rõ giới tính'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function suaGanNhatLabel(row?: PatientProfile['sua_gan_nhat']) {
  if (!row) return 'Chưa từng chỉnh sửa'
  const nguoi = row.nguoi.ho_ten || 'Không rõ người thực hiện'
  return `${row.nhan} · ${nguoi} · ${formatDateTime(row.thoi_diem)}`
}

function lichSuKhamLabel(lichSuKham?: PatientProfile['lich_su_kham']) {
  if (!lichSuKham) return 'Khách mới · chưa có lượt khám hoàn thành'
  const ngay = new Date(lichSuKham.lan_gan_nhat).toLocaleDateString('vi-VN')
  const bacSi = lichSuKham.bac_si_gan_nhat ? ` với ${lichSuKham.bac_si_gan_nhat}` : ''
  return `Khách cũ · đã khám ${lichSuKham.so_lan} lần · gần nhất ${ngay}${bacSi}`
}

function paymentLabel(status: string) {
  return ({ paid: 'Đã trả phí khám', partial: 'Đã trả một phần', unpaid: 'Chưa trả phí khám', refunded: 'Đã hoàn phí khám' } as Record<string, string>)[status] ?? status
}

function appointmentStatusLabel(status: string) {
  return ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', checked_in: 'Đã tiếp nhận', in_progress: 'Đang khám', completed: 'Hoàn thành', cancelled: 'Đã hủy', no_show: 'Không đến' } as Record<string, string>)[status] ?? status
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
  return appointment.status === 'confirmed'
}

export default function PatientIntake() {
  const [phone, setPhone] = useState('')
  const [profiles, setProfiles] = useState<PatientProfile[]>([])
  const [accounts, setAccounts] = useState<OnlineAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [ambiguousAppointments, setAmbiguousAppointments] = useState<TodayAppointment[]>([])
  const [accountAppointments, setAccountAppointments] = useState<TodayAppointment[]>([])
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
  const [editingProfile, setEditingProfile] = useState<PatientProfile | null>(null)
  const [auditProfileId, setAuditProfileId] = useState<string | null>(null)
  const [linkAccount, setLinkAccount] = useState(true)
  const [printData, setPrintData] = useState<QueueTicketData | null>(null)

  // window.print() la ham dong bo chan UI — phai goi SAU khi QueueTicketTemplate da render
  // xong voi printData moi, neu khong se in ra phieu trong (E-7).
  useEffect(() => {
    if (printData) window.print()
  }, [printData])

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
    setSelectedAccountId(null)
    setAccounts([])
    setAmbiguousAppointments([])
    setAccountAppointments([])
    setLinkAccount(true)
    clearDecision()
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại để tra cứu')
      return
    }

    setLoading(true)
    try {
      const result = await receptionistPatientIntakeService.searchByPhone(phone)
      setProfiles(result.profiles)
      setAccounts(result.accounts || [])
      if ((result.accounts || []).length === 1) setSelectedAccountId(result.accounts[0].id)
      setAmbiguousAppointments(result.ambiguous_appointments || [])
      setAccountAppointments(result.account_appointments || [])
      setMessage(result.total
        ? `Tìm thấy ${result.total} hồ sơ. Hãy xác nhận đúng người bệnh trước khi tiếp nhận.`
        : result.accounts?.length ? 'Tìm thấy tài khoản online nhưng chưa có hồ sơ bệnh nhân; hãy chọn đúng tài khoản trước khi tạo hồ sơ.' : 'Chưa có hồ sơ hoặc tài khoản, có thể tạo mới tại quầy.')
    } catch (requestError: any) {
      setProfiles([])
      setAccounts([])
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
        // E-9: lễ tân có thể chủ động không liên kết tài khoản online dù số điện thoại đã có
        // tài khoản (khách dùng nhờ số) — không gửi tai_khoan_id để backend không đối chiếu.
        tai_khoan_id: linkAccount ? selectedAccountId || undefined : undefined,
      })
      const refreshed = await receptionistPatientIntakeService.searchByPhone(phone.trim())
      setProfiles(refreshed.profiles)
      setSelectedId(refreshed.profiles.find((item) => item.id === profile.id)?.id || profile.id)
      setPhone(profile.so_dien_thoai || phone)
      setAccounts(refreshed.accounts || [])
      setSelectedAccountId(null)
      setLinkAccount(true)
      setAmbiguousAppointments(refreshed.ambiguous_appointments || [])
      setAccountAppointments(refreshed.account_appointments || [])
      setForm(emptyForm)
      setMessage(refreshed.account_appointments?.some((appointment) => appointment.status === 'confirmed')
        ? 'Đã tạo và gắn hồ sơ với tài khoản online. Hãy chọn lịch hẹn để xác nhận người bệnh đến khám và đưa vào hàng đợi bác sĩ.'
        : 'Đã tạo hồ sơ. Chưa có lịch hẹn đủ điều kiện check-in hôm nay.')
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
      // Lay tu chinh ho so da chon, KHONG lay tu so dien thoai tra cuu — backend so khop
      // theo SDT cua ho so (co the khac so lien he khi ho so la thanh vien gia dinh).
      const response = await receptionistPatientIntakeService.checkInAppointment(selectedAppointment.id, {
        ho_so_benh_nhan_id: selectedProfile.id,
        so_dien_thoai: selectedProfile.so_dien_thoai || phone,
        ho_ten: selectedProfile.ho_ten,
      })
      const warnings = response.canh_bao
      const queueCode = response.hang_doi.ma_so_thu_tu
      setMessage(`Đã ghi nhận người bệnh đến khám theo lịch hẹn ${selectedAppointment.ma_lich_hen || selectedAppointment.id}.${queueCode ? ` Số thứ tự: ${queueCode}.` : ''} ${warnings.length ? `Lưu ý: ${warnings.join(' ')}` : 'Người bệnh đã được đưa vào hàng đợi của bác sĩ.'}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: response.hang_doi.id, trang_thai: 'dang_cho', doctor_id: response.hang_doi.doctor_id, phong_kham: response.hang_doi.phong_kham, checkin_time: response.hang_doi.checkin_time, so_thu_tu_checkin: response.hang_doi.so_thu_tu_checkin, ma_so_thu_tu: response.hang_doi.ma_so_thu_tu } }
        : profile))
      
      setPrintData({
        patientName: selectedProfile.ho_ten,
        doctorName: selectedAppointment.doctor?.ho_ten || 'Chưa gán',
        roomNumber: response.hang_doi.phong_kham || 'Chưa gán',
        queueNumber: response.hang_doi.ma_so_thu_tu || '—',
        appointmentTime: selectedAppointment.gio_kham,
      })

      // Reset form để tiếp nhận người tiếp theo
      setPhone('')
      setProfiles([])
      setSelectedId(null)
      clearDecision()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể ghi nhận người bệnh đến khám. Vui lòng tải lại dữ liệu.')
    } finally {
      setCheckingIn(false)
    }
  }

  const createProfileAndCheckIn = async (appointment: TodayAppointment) => {
    // Khong doan tai khoan khi co nhieu tai khoan cung so dien thoai — chi dung dung tai khoan
    // gan voi lich hen nay hoac tai khoan lo tan da xac nhan chon (E-9).
    const account = accounts.find((item) => item.id === appointment.tai_khoan_id) || (accounts.length === 1 ? accounts[0] : null)
    const patientName = appointment.ten_khach || account?.ho_ten || ''
    const patientPhone = appointment.so_dien_thoai_khach || phone.trim()
    const accountId = appointment.tai_khoan_id || account?.id || null
    if (!patientName || !patientPhone || !accountId) {
      setError('Chưa đủ thông tin để tạo hồ sơ và check-in. Nếu số điện thoại có nhiều tài khoản, hãy chọn đúng tài khoản trước khi tạo hồ sơ.')
      return
    }

    setSaving(true)
    setCheckingIn(true)
    setError('')
    setMessage('')
    try {
      const profile = await receptionistPatientIntakeService.createProfile({
        ho_ten: patientName,
        so_dien_thoai: patientPhone,
        tai_khoan_id: accountId,
      })
      const response = await receptionistPatientIntakeService.checkInAppointment(appointment.id, {
        ho_so_benh_nhan_id: profile.id,
        so_dien_thoai: patientPhone,
        ho_ten: patientName,
      })
      const refreshed = await receptionistPatientIntakeService.searchByPhone(patientPhone)
      setProfiles(refreshed.profiles)
      setSelectedId(refreshed.profiles.find((item) => item.id === profile.id)?.id || profile.id)
      setSelectedAppointmentId(appointment.id)
      setAccounts(refreshed.accounts || [])
      setAmbiguousAppointments(refreshed.ambiguous_appointments || [])
      setAccountAppointments(refreshed.account_appointments || [])
      setPhone(patientPhone)
      setMessage(`Đã tạo hồ sơ và đưa ${patientName} vào hàng đợi của ${appointment.doctor?.ho_ten || 'bác sĩ phụ trách'} theo lịch ${appointment.ma_lich_hen || appointment.id}.`)
      setPrintData({
        patientName,
        doctorName: appointment.doctor?.ho_ten || 'Chưa gán',
        roomNumber: response.hang_doi.phong_kham || 'Chưa gán',
        queueNumber: response.hang_doi.ma_so_thu_tu || '—',
        appointmentTime: appointment.gio_kham,
      })
      return response
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo hồ sơ hoặc đưa người bệnh vào hàng đợi bác sĩ.')
    } finally {
      setSaving(false)
      setCheckingIn(false)
    }
  }

  const handleProfileSaved = async ({ profile }: { profile: PatientProfile; changed_fields: string[] }) => {
    setEditingProfile(null)
    // So dien thoai co the da doi (E-2) — tra cuu lai theo so MOI de danh sach khop, khong
    // de ho so bien mat khoi ket qua cu (rule: doi SDT phai lam moi lai theo so moi).
    const nextPhone = profile.so_dien_thoai || phone
    try {
      const refreshed = await receptionistPatientIntakeService.searchByPhone(nextPhone)
      setProfiles(refreshed.profiles)
      setAccounts(refreshed.accounts || [])
      setAmbiguousAppointments(refreshed.ambiguous_appointments || [])
      setAccountAppointments(refreshed.account_appointments || [])
      setPhone(nextPhone)
      setSelectedId(refreshed.profiles.find((item) => item.id === profile.id)?.id || profile.id)
      setMessage('Đã cập nhật thông tin hành chính của hồ sơ.')
    } catch {
      setMessage('Đã cập nhật thông tin hành chính của hồ sơ. Hãy tra cứu lại để xem dữ liệu mới nhất.')
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
      setMessage(`Đã tiếp nhận ${selectedProfile.ho_ten} vào hàng đợi khám. Số thứ tự: ${result.entry.ma_so_thu_tu || result.entry._id}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: result.entry._id, trang_thai: 'dang_cho', doctor_id: String(result.slot.doctor_id), phong_kham: result.slot.phong_kham, checkin_time: result.entry.checkin_time || new Date().toISOString(), so_thu_tu_checkin: result.entry.so_thu_tu_checkin, ma_so_thu_tu: result.entry.ma_so_thu_tu } }
        : profile))

      const doctorName = availability?.minh_chung_suc_chua.find((row) => row.doctor_id === selectedSlot.doctor_id)?.bac_si || 'Chưa gán'
      setPrintData({
        patientName: selectedProfile.ho_ten,
        doctorName,
        roomNumber: result.slot.phong_kham || 'Chưa gán',
        queueNumber: result.entry.ma_so_thu_tu || '—',
        appointmentTime: selectedSlot.gio_bat_dau,
      })

      // Reset form để tiếp nhận người tiếp theo
      setPhone('')
      setProfiles([])
      setSelectedId(null)
      clearDecision()
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

          {accounts.length > 0 && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-violet-950">Tài khoản online tìm thấy</p>
                  <p className="mt-1 text-xs text-violet-800">Email là định danh đăng nhập. Nếu có nhiều tài khoản dùng chung số điện thoại, hãy xác nhận đúng email trước khi gắn hồ sơ.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700">{accounts.length} tài khoản</span>
              </div>
              <div className="mt-3 space-y-2">
                {accounts.map((account) => (
                  <button key={account.id} type="button" onClick={() => setSelectedAccountId(account.id)} className={`w-full rounded-lg border p-3 text-left ${selectedAccountId === account.id ? 'border-violet-500 bg-white ring-2 ring-violet-100' : 'border-violet-200 bg-white/60 hover:border-violet-400'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{account.email}</p>
                        <p className="mt-1 text-xs text-slate-600">{account.ho_ten} · {account.phuong_thuc_dang_nhap === 'google_va_email' ? 'Google + Email/mật khẩu' : account.phuong_thuc_dang_nhap === 'google' ? 'Google' : 'Email/mật khẩu'}{account.email_verified ? ' · Email đã xác minh' : ''}</p>
                      </div>
                      <span className="text-xs font-semibold text-violet-700">{selectedAccountId === account.id ? 'Đã chọn' : 'Chọn'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {profiles.length === 0 && accountAppointments.length > 0 && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">Lịch hẹn online của tài khoản đã chọn</p>
              <p className="mt-1 text-xs leading-5 text-blue-800">Lịch hẹn đã được tìm thấy theo tài khoản/email. Cần tạo hồ sơ bệnh nhân và xác minh đúng họ tên trước khi check-in vào hàng đợi bác sĩ.</p>
              <div className="mt-3 space-y-2">
                {accountAppointments.map((appointment) => {
                  const canCheckIn = appointmentIsCheckinable(appointment)
                  return (
                    <div key={appointment.id} className="rounded-lg border border-blue-100 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">{appointment.gio_kham} · {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</p>
                          <p className="mt-1 text-xs text-slate-600">{appointment.ma_lich_hen || appointment.id} · {appointment.chuyen_khoa?.ten || 'Chưa có chuyên khoa'} · {appointment.phong_kham || 'Chưa có phòng'}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${canCheckIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                          {appointmentStatusLabel(appointment.status)}
                        </span>
                      </div>
                      {canCheckIn ? (
                        <button
                          type="button"
                          onClick={() => void createProfileAndCheckIn(appointment)}
                          disabled={saving || checkingIn}
                          className="mt-3 min-h-10 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving || checkingIn ? 'Đang tạo hồ sơ và đưa vào hàng đợi...' : 'Tạo hồ sơ và check-in lịch này'}
                        </button>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-slate-600">Lịch này không thể check-in vì đã ở trạng thái {appointmentStatusLabel(appointment.status).toLowerCase()}.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {profiles.map((profile) => {
              const age = calcAge(profile.ngay_sinh)
              return (
                <button key={profile.id} type="button" onClick={() => selectProfile(profile)} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === profile.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{profile.ho_ten}</p>
                      <p className="mt-1 text-sm text-slate-500">Ngày sinh: {formatDate(profile.ngay_sinh)}{age !== null ? ` (${age} tuổi)` : ''} · {genderLabel(profile.gioi_tinh)}</p>
                      {/* SĐT của chính hồ sơ — khác số vừa tra cứu là manh mối quan trọng khi số thuộc người giám hộ (E-8). */}
                      <p className="mt-1 text-xs text-slate-500">SĐT hồ sơ: {profile.so_dien_thoai || 'Chưa cập nhật'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {profile.nguoi_lien_he?.ho_ten ? `Người liên hệ: ${profile.nguoi_lien_he.ho_ten}` : profile.member_id ? 'Thành viên gia đình' : 'Hồ sơ tại quầy'}
                        {profile.quan_he ? ` · Quan hệ: ${profile.quan_he}` : ''}
                        {profile.nhom_gia_dinh ? ` · Nhóm gia đình: ${profile.nhom_gia_dinh}` : ''}
                      </p>
                      <p className={`mt-1 text-xs font-semibold ${profile.tai_khoan ? 'text-violet-700' : 'text-slate-500'}`}>{profile.tai_khoan ? `Tài khoản: ${profile.tai_khoan.email} · ${profile.tai_khoan.phuong_thuc_dang_nhap === 'google_va_email' ? 'Google + Email' : profile.tai_khoan.phuong_thuc_dang_nhap === 'google' ? 'Google' : 'Email'}` : 'Chưa liên kết tài khoản online'}</p>
                      <p className="mt-1 text-xs font-medium text-emerald-700">{lichSuKhamLabel(profile.lich_su_kham)}</p>
                      <p className="mt-1 text-xs text-slate-500">Sửa gần nhất: {suaGanNhatLabel(profile.sua_gan_nhat)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${profile.lich_hen_hom_nay.length ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                        {profile.lich_hen_hom_nay.length ? `${profile.lich_hen_hom_nay.length} lịch hôm nay` : 'Chưa có lịch'}
                      </span>
                      {profile.luot_dang_cho_hom_nay && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Đang ở hàng đợi</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {selectedProfile && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Đã xác nhận hồ sơ</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{selectedProfile.ho_ten}</p>
                    <p className="mt-1 text-sm text-slate-600">Ngày sinh: {formatDate(selectedProfile.ngay_sinh)} · Số liên hệ: {selectedProfile.so_dien_thoai || phone}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">{lichSuKhamLabel(selectedProfile.lich_su_kham)}</p>
                    <p className="mt-1 text-xs text-slate-500">Sửa gần nhất: {suaGanNhatLabel(selectedProfile.sua_gan_nhat)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingProfile(selectedProfile)} className="min-h-9 rounded-lg border border-brand-300 bg-white px-3 text-xs font-semibold text-brand-800 hover:bg-brand-50">
                      Sửa thông tin hành chính
                    </button>
                    <button type="button" onClick={() => setAuditProfileId(selectedProfile.id)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Lịch sử cập nhật
                    </button>
                  </div>
                </div>
                {hasActiveQueue && <p className="mt-3 text-sm font-semibold text-amber-800">Hồ sơ này đã có lượt đang xử lý hôm nay tại {selectedProfile.luot_dang_cho_hom_nay?.phong_kham || 'phòng khám'}{selectedProfile.luot_dang_cho_hom_nay?.ma_so_thu_tu ? ` · Số thứ tự ${selectedProfile.luot_dang_cho_hom_nay.ma_so_thu_tu}` : ''}.</p>}
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

        <section id="create-profile-section" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h3 className="text-base font-bold text-slate-800">Tạo hồ sơ mới</h3><p className="mt-1 text-sm text-slate-500">Chỉ dùng khi người bệnh chưa có hồ sơ. Số điện thoại trùng không đồng nghĩa là cùng một người.</p>{accounts.length > 0 && (linkAccount ? <p className="mt-1 text-xs font-semibold text-violet-700">Hồ sơ mới sẽ được gắn với tài khoản đã chọn: {accounts.find((account) => account.id === selectedAccountId)?.email || 'chưa chọn tài khoản'}.</p> : <p className="mt-1 text-xs font-semibold text-slate-600">Hồ sơ mới sẽ KHÔNG gắn với tài khoản online nào (khách dùng nhờ số).</p>)}</div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Không tạo lịch hẹn</span>
          </div>
          <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={createProfile}>
            <label className="text-sm font-medium text-slate-700">Họ tên *<input required value={form.ho_ten} onChange={(event) => setForm({ ...form, ho_ten: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></label>
            {accounts.length > 0 && (
              <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={!linkAccount} onChange={(event) => { setLinkAccount(!event.target.checked); if (event.target.checked) setSelectedAccountId(null) }} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span>Không liên kết tài khoản online (khách dùng nhờ số)<span className="mt-0.5 block text-xs font-normal text-slate-500">Tick khi số điện thoại này thuộc người khác, không phải chủ tài khoản online.</span></span>
              </label>
            )}
            <div className="text-sm font-medium text-slate-700">Số liên hệ đã tra cứu<div className={`mt-1.5 flex min-h-11 items-center rounded-xl border px-3 text-sm ${phone ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{phone || 'Chưa nhập số điện thoại ở bước tra cứu'}</div><p className="mt-1 text-xs font-normal text-slate-500">Hệ thống sẽ tự dùng số này cho hồ sơ mới.</p></div>
            <label className="text-sm font-medium text-slate-700">Ngày sinh<input type="date" value={form.ngay_sinh} onChange={(event) => setForm({ ...form, ngay_sinh: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /></label>
            <label className="text-sm font-medium text-slate-700">Giới tính<select value={form.gioi_tinh} onChange={(event) => setForm({ ...form, gioi_tinh: event.target.value as typeof form.gioi_tinh })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"><option value="">Chưa cập nhật</option><option value="nam">Nam</option><option value="nu">Nữ</option><option value="khac">Khác</option></select></label>
            <button type="submit" disabled={saving || (linkAccount && accounts.length > 0 && !selectedAccountId)} className="min-h-11 self-end rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Đang lưu...' : linkAccount && accounts.length > 0 && !selectedAccountId ? 'Chọn tài khoản trước' : 'Tạo hồ sơ'}</button>
          </form>
          <p className="mt-2 text-xs text-slate-400">Nhóm máu, dị ứng, bệnh nền, địa chỉ... có thể bổ sung sau trong màn chỉnh sửa hồ sơ.</p>
        </section>
      </div>

      {editingProfile && (
        <ProfileAdminEditModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSaved={handleProfileSaved}
        />
      )}
      {auditProfileId && (
        <TimelinePanel
          loai="ho_so"
          id={auditProfileId}
          title="Lịch sử cập nhật hồ sơ"
          onClose={() => setAuditProfileId(null)}
        />
      )}

      {/* Component In Phiếu Ẩn */}
      <QueueTicketTemplate data={printData} />

      {/* Nút in lại khi máy in kẹt — không check-in lại, chỉ in lại đúng phiếu vừa rồi */}
      {printData && (
        <div className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
          <span className="text-xs text-slate-600">Phiếu số {printData.queueNumber}</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
          >
            In lại phiếu
          </button>
          <button
            type="button"
            onClick={() => setPrintData(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
