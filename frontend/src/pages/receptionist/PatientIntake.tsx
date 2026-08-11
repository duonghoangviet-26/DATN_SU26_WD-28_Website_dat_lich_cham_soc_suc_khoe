import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CapacityEvidence,
  OfflineAvailability,
  OnlineAccount,
  PatientProfile,
  TodayAppointment,
  getUnlinkedAccountAppointments,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'
import ProfileAdminEditModal from '@/components/receptionist/ProfileAdminEditModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'
import QueueTicketTemplate, { QueueTicketData } from '@/components/receptionist/QueueTicketTemplate'
import CheckInVerifyModal from '@/components/receptionist/CheckInVerifyModal'
import { PageShell, ReceptionistHeader } from '@/components/receptionist/ReceptionistUI'
import axiosInstance from '@/services/axiosInstance'
import {
  getLatestAllowedBirthDateInput,
  normalizePersonName,
  normalizePhoneInput,
  validateBirthDate,
  validatePatientName,
  validateVietnamesePhone,
} from '@/utils/patientIdentityValidation'

interface ReceptionistTodayAppointment {
  _id: string
  ngay_kham: string
  gio_kham: string
  status: string
  payment_status: string
  user_id: { ho_ten?: string | null; so_dien_thoai?: string | null } | null
  doctor_id: { _id?: string; user_id?: { ho_ten?: string | null } } | null
  ten_khach?: string | null
  so_dien_thoai_khach?: string | null
  ma_lich_hen?: string | null
  ten_dich_vu?: string | null
  allowed_actions?: Array<'check_in' | 'reschedule' | 'late_reschedule' | 'cancel'>
  lock_reason?: string | null
  sua_gan_nhat?: { nhan: string; thoi_diem: string; nguoi?: { ho_ten?: string | null } } | null
}

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
  return `${row.nhan} - ${nguoi} - ${formatDateTime(row.thoi_diem)}`
}

function lichSuKhamLabel(lichSuKham?: PatientProfile['lich_su_kham']) {
  if (!lichSuKham) return 'Khách mới, chưa có lượt khám hoàn thành'
  const ngay = new Date(lichSuKham.lan_gan_nhat).toLocaleDateString('vi-VN')
  const bacSi = lichSuKham.bac_si_gan_nhat ? ` với ${lichSuKham.bac_si_gan_nhat}` : ''
  return `Khách cũ, đã khám ${lichSuKham.so_lan} lần, gần nhất ${ngay}${bacSi}`
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

function todayAppointmentIsCheckinable(appointment: ReceptionistTodayAppointment) {
  if (Array.isArray(appointment.allowed_actions)) return appointment.allowed_actions.includes('check_in')
  return appointment.status === 'confirmed'
}

function appointmentStatusTone(status: string) {
  if (status === 'checked_in') return 'bg-emerald-100 text-emerald-800'
  if (status === 'completed') return 'bg-blue-100 text-blue-800'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800'
  if (status === 'no_show') return 'bg-slate-200 text-slate-700'
  if (status === 'pending') return 'bg-amber-100 text-amber-800'
  return 'bg-brand-100 text-brand-800'
}

function TodayAppointmentTab({
  onTicketReady,
}: {
  onTicketReady: (data: QueueTicketData) => void
}) {
  const [appointments, setAppointments] = useState<ReceptionistTodayAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'active' | 'confirmed' | 'checked_in' | 'changed' | 'all'>('active')
  const [checkInAppointment, setCheckInAppointment] = useState<ReceptionistTodayAppointment | null>(null)
  const [timelineApptId, setTimelineApptId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const loadAppointments = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axiosInstance.get('/receptionist/appointments', {
        params: {
          timeframe: 'today',
          limit: 100,
          status: status === 'all' || status === 'active' || status === 'changed' ? undefined : status,
          search: query.trim() || undefined,
        },
      })
      const rows = Array.isArray(response.data?.data) ? response.data.data : []
      setAppointments(rows)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải lịch hẹn hôm nay')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filteredAppointments = useMemo(() => {
    let rows = appointments
    if (status === 'active') rows = rows.filter((appointment) => appointment.status !== 'cancelled')
    if (status === 'changed') rows = rows.filter((appointment) => Boolean(appointment.sua_gan_nhat) || appointment.status === 'cancelled')
    return [...rows].sort((a, b) => b.gio_kham.localeCompare(a.gio_kham))
  }, [appointments, status])

  const summary = useMemo(() => ({
    total: appointments.length,
    waiting: appointments.filter((appointment) => appointment.status === 'confirmed' || appointment.status === 'pending').length,
    checkedIn: appointments.filter((appointment) => appointment.status === 'checked_in').length,
    changed: appointments.filter((appointment) => Boolean(appointment.sua_gan_nhat) || appointment.status === 'cancelled').length,
  }), [appointments])

  const handleCheckedIn = (
    result: { hang_doi: { phong_kham?: string | null; ma_so_thu_tu?: string | null }; canh_bao: string[]; ten_benh_nhan: string },
  ) => {
    if (checkInAppointment) {
      onTicketReady({
        patientName: result.ten_benh_nhan,
        doctorName: checkInAppointment.doctor_id?.user_id?.ho_ten || 'Chưa gán',
        roomNumber: result.hang_doi.phong_kham || 'Chưa gán',
        queueNumber: result.hang_doi.ma_so_thu_tu || '-',
        appointmentTime: checkInAppointment.gio_kham,
        serviceName: checkInAppointment.ten_dich_vu || undefined,
      })
    }
    setNotice(`Đã check-in ${result.ten_benh_nhan}${result.hang_doi.ma_so_thu_tu ? ` - số thứ tự ${result.hang_doi.ma_so_thu_tu}` : ''}.`)
    setCheckInAppointment(null)
    void loadAppointments()
    if (result.canh_bao.length) setError(result.canh_bao.join(' '))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Lịch hẹn hôm nay</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Tab này dùng để xem tổng quan trong ngày, kiểm tra lịch vừa thay đổi và check-in nhanh khi khách online đến quầy.
          </p>
        </div>
        <button type="button" onClick={loadAppointments} disabled={loading} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Tổng lịch</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">Chưa đến</p>
          <p className="mt-1 text-xl font-bold text-amber-950">{summary.waiting}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Đã check-in</p>
          <p className="mt-1 text-xl font-bold text-emerald-950">{summary.checkedIn}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-700">Có thay đổi</p>
          <p className="mt-1 text-xl font-bold text-blue-950">{summary.changed}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'active', label: 'Đang hoạt động' },
            { key: 'confirmed', label: 'Chưa đến' },
            { key: 'checked_in', label: 'Đã check-in' },
            { key: 'changed', label: 'Có thay đổi' },
            { key: 'all', label: 'Tất cả' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatus(item.key as typeof status)}
              className={`min-h-10 rounded-xl px-3 text-xs font-bold transition ${status === item.key ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); void loadAppointments() }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên, SĐT hoặc mã lịch"
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" className="min-h-10 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
            Tìm
          </button>
        </form>
      </div>

      {(notice || error) && (
        <div className="mt-4 grid gap-2">
          {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{notice}</p>}
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">{error}</p>}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Giờ</th>
                <th className="px-4 py-3">Bệnh nhân</th>
                <th className="px-4 py-3">Bác sĩ</th>
                <th className="px-4 py-3">Thanh toán / trạng thái</th>
                <th className="px-4 py-3">Thay đổi</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Đang tải lịch hẹn...</td></tr>
              ) : filteredAppointments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Không có lịch hẹn phù hợp.</td></tr>
              ) : filteredAppointments.map((appointment) => {
                const patientName = appointment.user_id?.ho_ten || appointment.ten_khach || 'Khách vãng lai'
                const patientPhone = appointment.user_id?.so_dien_thoai || appointment.so_dien_thoai_khach || ''
                const canCheckIn = todayAppointmentIsCheckinable(appointment)
                return (
                  <tr key={appointment._id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold tabular-nums text-slate-950">{appointment.gio_kham}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{appointment.ma_lich_hen || appointment._id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{patientName}</p>
                      <p className="mt-1 text-xs text-slate-500">{patientPhone || 'Chưa có SĐT'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{appointment.doctor_id?.user_id?.ho_ten || 'Chưa gán'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{paymentLabel(appointment.payment_status)}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${appointmentStatusTone(appointment.status)}`}>{appointmentStatusLabel(appointment.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {appointment.sua_gan_nhat ? (
                        <button type="button" onClick={() => setTimelineApptId(appointment._id)} className="max-w-[220px] text-left text-xs font-semibold text-brand-700 hover:underline">
                          {appointment.sua_gan_nhat.nhan} - {formatDateTime(appointment.sua_gan_nhat.thoi_diem)}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có thay đổi</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setTimelineApptId(appointment._id)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          Lịch sử
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckInAppointment(appointment)}
                          disabled={!canCheckIn || !patientPhone}
                          className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title={!patientPhone ? 'Lịch chưa có số điện thoại để xác minh hồ sơ' : undefined}
                        >
                          Check-in
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {checkInAppointment && (
        <CheckInVerifyModal
          appointmentId={checkInAppointment._id}
          maLichHen={checkInAppointment.ma_lich_hen}
          searchPhone={checkInAppointment.user_id?.so_dien_thoai || checkInAppointment.so_dien_thoai_khach || ''}
          onClose={() => setCheckInAppointment(null)}
          onCheckedIn={handleCheckedIn}
        />
      )}

      {timelineApptId && (
        <TimelinePanel
          loai="lich_hen"
          id={timelineApptId}
          title="Lịch sử thao tác lịch hẹn"
          onClose={() => setTimelineApptId(null)}
        />
      )}
    </section>
  )
}

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value || 'Chưa cập nhật'}</dd>
    </div>
  )
}

function StepIndicator({ step, label, state }: { step: number; label: string; state: 'done' | 'active' | 'locked' }) {
  const tone = state === 'active'
    ? 'border-brand-600 bg-brand-600 text-white'
    : state === 'done'
      ? 'border-brand-200 bg-brand-50 text-brand-800'
      : 'border-slate-200 bg-white text-slate-400'

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${tone}`}>{step}</span>
      <span className={`truncate text-sm font-semibold ${state === 'locked' ? 'text-slate-400' : 'text-slate-800'}`}>{label}</span>
    </div>
  )
}

export default function PatientIntake() {
  const [phone, setPhone] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [profiles, setProfiles] = useState<PatientProfile[]>([])
  const [accounts, setAccounts] = useState<OnlineAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [ambiguousAppointments, setAmbiguousAppointments] = useState<TodayAppointment[]>([])
  const [accountAppointments, setAccountAppointments] = useState<TodayAppointment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'booked' | 'walk_in'>('idle')
  const [showCreateForm, setShowCreateForm] = useState(false)
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
  const [searchPhoneError, setSearchPhoneError] = useState('')
  const [formErrors, setFormErrors] = useState<{ ho_ten?: string; ngay_sinh?: string }>({})
  const [workspaceTab, setWorkspaceTab] = useState<'lookup' | 'today'>('lookup')

  useEffect(() => {
    if (printData) window.print()
  }, [printData])

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null
  const selectedAppointment = selectedProfile?.lich_hen_hom_nay.find((appointment) => appointment.id === selectedAppointmentId) ?? null
  const selectedSlot = availability?.slots.find((slot) => slot.slot_id === selectedSlotId) ?? null
  const hasAppointmentToday = Boolean(selectedProfile?.lich_hen_hom_nay.length)
  const hasActiveQueue = Boolean(selectedProfile?.luot_dang_cho_hom_nay)
  const unlinkedAccountAppointments = getUnlinkedAccountAppointments(profiles, accountAppointments)

  const capacitySummary = useMemo(() => {
    if (!availability) return null
    const rows = availability.minh_chung_suc_chua || []
    return {
      availableDoctors: rows.filter((row) => row.ket_luan === 'co_the_tiep_nhan').length,
      availableSlots: rows.reduce((total, row) => total + row.walk_in_con_lai, 0),
    }
  }, [availability])

  const latestAllowedBirthDateInput = getLatestAllowedBirthDateInput()

  const clearDecision = () => {
    setAvailability(null)
    setSelectedSlotId(null)
    setSelectedAppointmentId(null)
    setMode('idle')
  }

  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setMessage('')
    setHasSearched(false)
    setSelectedId(null)
    setSelectedAccountId(null)
    setAccounts([])
    setAmbiguousAppointments([])
    setAccountAppointments([])
    setLinkAccount(true)
    setShowCreateForm(false)
    setSearchPhoneError('')
    clearDecision()
    const normalizedPhone = normalizePhoneInput(phone)
    const phoneError = validateVietnamesePhone(normalizedPhone)
    if (phoneError) {
      setSearchPhoneError(phoneError)
      return
    }

    setLoading(true)
    try {
      setPhone(normalizedPhone)
      const result = await receptionistPatientIntakeService.searchByPhone(normalizedPhone)
      setProfiles(result.profiles)
      setAccounts(result.accounts || [])
      if ((result.accounts || []).length === 1) setSelectedAccountId(result.accounts[0].id)
      setAmbiguousAppointments(result.ambiguous_appointments || [])
      setAccountAppointments(result.account_appointments || [])
      setHasSearched(true)
      setShowCreateForm(!result.total)
      setMessage(result.total
        ? `Tìm thấy ${result.total} hồ sơ. Hãy chọn đúng người bệnh trước khi thao tác.`
        : result.accounts?.length ? 'Tìm thấy tài khoản online nhưng chưa có hồ sơ bệnh nhân. Có thể chọn tài khoản để tạo hồ sơ mới.' : 'Chưa có hồ sơ. Hãy tạo hồ sơ mới tại quầy.')
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
    setShowCreateForm(false)
    setError('')
    setMessage('')
    clearDecision()
  }

  const createProfile = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    const normalizedPhone = normalizePhoneInput(phone)
    const normalizedName = normalizePersonName(form.ho_ten)
    const nextErrors = {
      ho_ten: validatePatientName(normalizedName) || undefined,
      ngay_sinh: validateBirthDate(form.ngay_sinh) || undefined,
    }
    setFormErrors(nextErrors)
    if (!normalizedPhone) {
      setSearchPhoneError('Vui lòng nhập số điện thoại ở bước tra cứu trước khi tạo hồ sơ mới.')
      return
    }
    if (nextErrors.ho_ten || nextErrors.ngay_sinh) {
      return
    }
    const phoneError = validateVietnamesePhone(normalizedPhone)
    if (phoneError) {
      setSearchPhoneError(phoneError)
      return
    }
    setSaving(true)
    try {
      const profile = await receptionistPatientIntakeService.createProfile({
        ho_ten: normalizedName,
        so_dien_thoai: normalizedPhone,
        ngay_sinh: form.ngay_sinh || undefined,
        gioi_tinh: form.gioi_tinh || undefined,
        tai_khoan_id: linkAccount ? selectedAccountId || undefined : undefined,
      })
      const refreshed = await receptionistPatientIntakeService.searchByPhone(normalizedPhone)
      setProfiles(refreshed.profiles)
      setSelectedId(refreshed.profiles.find((item) => item.id === profile.id)?.id || profile.id)
      setPhone(profile.so_dien_thoai || phone)
      setAccounts(refreshed.accounts || [])
      setSelectedAccountId(null)
      setLinkAccount(true)
      setAmbiguousAppointments(refreshed.ambiguous_appointments || [])
      setAccountAppointments(refreshed.account_appointments || [])
      setForm(emptyForm)
      setFormErrors({})
      setShowCreateForm(false)
      setHasSearched(true)
      setMessage('Đã tạo hồ sơ và tự chọn hồ sơ vừa tạo. Có thể tiếp tục chỉnh sửa, xem lịch sử hoặc đưa người bệnh vào khám.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo hồ sơ bệnh nhân')
    } finally {
      setSaving(false)
    }
  }

  const loadAvailability = async () => {
    setError('')
    setMessage('')
    setMode('walk_in')
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
      const response = await receptionistPatientIntakeService.checkInAppointment(selectedAppointment.id, {
        ho_so_benh_nhan_id: selectedProfile.id,
        so_dien_thoai: selectedProfile.so_dien_thoai || phone,
        ho_ten: selectedProfile.ho_ten,
      })
      const warnings = response.canh_bao
      const queueCode = response.hang_doi.ma_so_thu_tu
      setMessage(`Đã check-in lịch hẹn ${selectedAppointment.ma_lich_hen || selectedAppointment.id}.${queueCode ? ` Số thứ tự: ${queueCode}.` : ''} ${warnings.length ? `Lưu ý: ${warnings.join(' ')}` : 'Người bệnh đã được đưa vào hàng đợi của bác sĩ.'}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: response.hang_doi.id, trang_thai: 'dang_cho', doctor_id: response.hang_doi.doctor_id, phong_kham: response.hang_doi.phong_kham, checkin_time: response.hang_doi.checkin_time, so_thu_tu_checkin: response.hang_doi.so_thu_tu_checkin, ma_so_thu_tu: response.hang_doi.ma_so_thu_tu } }
        : profile))

      setPrintData({
        patientName: selectedProfile.ho_ten,
        doctorName: selectedAppointment.doctor?.ho_ten || 'Chưa gán',
        roomNumber: response.hang_doi.phong_kham || 'Chưa gán',
        queueNumber: response.hang_doi.ma_so_thu_tu || '-',
        appointmentTime: selectedAppointment.gio_kham,
      })

      setPhone('')
      setProfiles([])
      setSelectedId(null)
      setHasSearched(false)
      setShowCreateForm(false)
      clearDecision()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Chưa thể ghi nhận người bệnh đến khám. Vui lòng tải lại dữ liệu.')
    } finally {
      setCheckingIn(false)
    }
  }

  const createProfileAndCheckIn = async (appointment: TodayAppointment) => {
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
      setShowCreateForm(false)
      setMode('booked')
      setMessage(`Đã tạo hồ sơ và đưa ${patientName} vào hàng đợi của ${appointment.doctor?.ho_ten || 'bác sĩ phụ trách'} theo lịch ${appointment.ma_lich_hen || appointment.id}.`)
      setPrintData({
        patientName,
        doctorName: appointment.doctor?.ho_ten || 'Chưa gán',
        roomNumber: response.hang_doi.phong_kham || 'Chưa gán',
        queueNumber: response.hang_doi.ma_so_thu_tu || '-',
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
      setMessage(`Đã tiếp nhận walk-in ${selectedProfile.ho_ten} vào hàng đợi khám. Số thứ tự: ${result.entry.ma_so_thu_tu || result.entry._id}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: result.entry._id, trang_thai: 'dang_cho', doctor_id: String(result.slot.doctor_id), phong_kham: result.slot.phong_kham, checkin_time: result.entry.checkin_time || new Date().toISOString(), so_thu_tu_checkin: result.entry.so_thu_tu_checkin, ma_so_thu_tu: result.entry.ma_so_thu_tu } }
        : profile))

      const doctorName = availability?.minh_chung_suc_chua.find((row) => row.doctor_id === selectedSlot.doctor_id)?.bac_si || 'Chưa gán'
      setPrintData({
        patientName: selectedProfile.ho_ten,
        doctorName,
        roomNumber: result.slot.phong_kham || 'Chưa gán',
        queueNumber: result.entry.ma_so_thu_tu || '-',
        appointmentTime: selectedSlot.gio_bat_dau,
      })

      setPhone('')
      setProfiles([])
      setSelectedId(null)
      setHasSearched(false)
      setShowCreateForm(false)
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

  const lookupState = hasSearched ? 'done' : 'active'
  const profileState = selectedProfile ? 'done' : hasSearched ? 'active' : 'locked'
  const actionState = selectedProfile ? 'active' : 'locked'
  const age = calcAge(selectedProfile?.ngay_sinh)

  return (
    <PageShell>
        <ReceptionistHeader
          eyebrow="Tiếp nhận & lịch hẹn"
          title="Tra cứu trước, chọn đúng luồng sau"
          description="Tab tra cứu là luồng chính khi khách đến quầy; tab lịch hẹn hôm nay dùng để xem tổng quan, kiểm tra thay đổi và check-in nhanh."
          metrics={
            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 lg:min-w-[560px]">
              <StepIndicator step={1} label="Tra số điện thoại" state={lookupState} />
              <StepIndicator step={2} label="Chọn hồ sơ" state={profileState} />
              <StepIndicator step={3} label="Khám/Check-in" state={actionState} />
            </div>
          }
        />

        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setWorkspaceTab('lookup')}
              className={`min-h-12 rounded-xl px-4 text-left text-sm font-bold transition ${workspaceTab === 'lookup' ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              Tra cứu & tiếp nhận
              <span className={`mt-0.5 block text-xs font-medium ${workspaceTab === 'lookup' ? 'text-brand-50' : 'text-slate-500'}`}>Nhập số điện thoại, kiểm tra hồ sơ, check-in online hoặc khám tại quầy</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('today')}
              className={`min-h-12 rounded-xl px-4 text-left text-sm font-bold transition ${workspaceTab === 'today' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              Lịch hẹn hôm nay
              <span className={`mt-0.5 block text-xs font-medium ${workspaceTab === 'today' ? 'text-slate-200' : 'text-slate-500'}`}>Xem số lượng, trạng thái, thay đổi gần đây và check-in nhanh</span>
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className="mb-4 grid gap-3">
            {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{message}</p>}
            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>}
          </div>
        )}

        {workspaceTab === 'lookup' ? (
        <main className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">1. Tra cứu liên hệ</h3>
                <p className="mt-1 text-sm text-slate-600">Nhập số điện thoại người đang đứng tại quầy hoặc người liên hệ.</p>
              </div>
              {hasSearched && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">{profiles.length} hồ sơ</span>}
            </div>

            <form className="mt-4 flex flex-col gap-3 sm:flex-row xl:flex-col" onSubmit={search}>
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(normalizePhoneInput(event.target.value))
                  if (searchPhoneError) setSearchPhoneError('')
                }}
                placeholder="Số điện thoại người liên hệ"
                inputMode="tel"
                maxLength={10}
                className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button type="submit" disabled={loading} className="min-h-12 rounded-xl bg-brand-700 px-5 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Đang tìm...' : 'Tra cứu hồ sơ'}
              </button>
            </form>

            {searchPhoneError && <p className="mt-2 text-sm font-medium text-rose-700">{searchPhoneError}</p>}

            {!hasSearched && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Sau khi tra cứu, hệ thống sẽ hiển thị hồ sơ đang gắn với số điện thoại này hoặc mở form tạo hồ sơ mới.
              </div>
            )}

            {ambiguousAppointments.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-bold">Có lịch hẹn hôm nay nhưng chưa khớp hồ sơ.</p>
                <p className="mt-1">Hãy đối chiếu mã lịch, họ tên và ngày sinh trước khi tạo hoặc gắn hồ sơ.</p>
                <div className="mt-3 space-y-2">
                  {ambiguousAppointments.map((appointment) => (
                    <p key={appointment.id} className="rounded-lg bg-white px-3 py-2 font-medium">
                      {appointment.ma_lich_hen || appointment.id} - {appointment.gio_kham} - {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {accounts.length > 0 && hasSearched && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-violet-950">Tài khoản online</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-violet-700">{accounts.length} tài khoản</span>
                </div>
                <div className="mt-3 space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${selectedAccountId === account.id ? 'border-violet-500 bg-white ring-2 ring-violet-100' : 'border-violet-200 bg-white/70 hover:border-violet-400'}`}
                    >
                      <span className="block text-sm font-bold text-slate-900">{account.ho_ten || account.email}</span>
                      <span className="mt-1 block text-xs text-slate-600">{account.email} - {account.so_dien_thoai || 'Chưa có số'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!hasSearched && (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div>
                  <p className="text-base font-bold text-slate-800">Bắt đầu bằng số điện thoại</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Các phần chọn hồ sơ, tạo hồ sơ và đưa vào khám sẽ chỉ xuất hiện sau khi có kết quả tra cứu.</p>
                </div>
              </div>
            )}

            {hasSearched && !selectedProfile && !showCreateForm && (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">2. Chọn đúng hồ sơ bệnh nhân</h3>
                    <p className="mt-1 text-sm text-slate-600">Một số điện thoại có thể đại diện cho cha mẹ, con cái hoặc người thân.</p>
                  </div>
                  <button type="button" onClick={() => setShowCreateForm(true)} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Tạo hồ sơ mới
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {profiles.map((profile) => {
                    const profileAge = calcAge(profile.ngay_sinh)
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => selectProfile(profile)}
                        className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-slate-950">{profile.ho_ten}</p>
                            <p className="mt-1 text-sm text-slate-600">{profile.so_dien_thoai || phone} - {genderLabel(profile.gioi_tinh)}{profileAge !== null ? ` - ${profileAge} tuổi` : ''}</p>
                          </div>
                          {profile.lich_hen_hom_nay.length > 0 && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">Có lịch hẹn</span>}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">{lichSuKhamLabel(profile.lich_su_kham)}</p>
                      </button>
                    )
                  })}
                </div>

                {unlinkedAccountAppointments.length > 0 && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <p className="font-bold">Có lịch online theo tài khoản nhưng chưa gắn hồ sơ.</p>
                    <div className="mt-3 space-y-2">
                      {unlinkedAccountAppointments.map((appointment) => (
                        <div key={appointment.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-semibold">{appointment.ma_lich_hen || appointment.id} - {appointment.gio_kham} - {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</span>
                          <button type="button" onClick={() => createProfileAndCheckIn(appointment)} disabled={saving || checkingIn} className="min-h-9 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                            Tạo hồ sơ và check-in
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasSearched && !selectedProfile && showCreateForm && (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Tạo hồ sơ mới</h3>
                    <p className="mt-1 text-sm text-slate-600">Số liên hệ sẽ tự lấy từ số điện thoại vừa tra cứu: <strong>{phone}</strong></p>
                  </div>
                  {profiles.length > 0 && (
                    <button type="button" onClick={() => setShowCreateForm(false)} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      Quay lại danh sách
                    </button>
                  )}
                </div>

                <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={createProfile}>
                  <label className="text-sm font-bold text-slate-700">
                    Họ tên *
                    <input
                      required
                      value={form.ho_ten}
                      onChange={(event) => {
                        setForm({ ...form, ho_ten: event.target.value })
                        if (formErrors.ho_ten) setFormErrors((current) => ({ ...current, ho_ten: undefined }))
                      }}
                      className={`mt-1.5 min-h-12 w-full rounded-xl border px-3 text-base outline-none focus:ring-2 ${formErrors.ho_ten ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'}`}
                    />
                    {formErrors.ho_ten && <span className="mt-1 block text-xs font-medium text-rose-700">{formErrors.ho_ten}</span>}
                  </label>
                  <div className="text-sm font-bold text-slate-700">
                    Số liên hệ
                    <div className="mt-1.5 flex min-h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{phone}</div>
                  </div>
                  <label className="text-sm font-bold text-slate-700">
                    Ngày sinh
                    <input
                      type="date"
                      max={latestAllowedBirthDateInput}
                      value={form.ngay_sinh}
                      onChange={(event) => {
                        setForm({ ...form, ngay_sinh: event.target.value })
                        if (formErrors.ngay_sinh) setFormErrors((current) => ({ ...current, ngay_sinh: undefined }))
                      }}
                      className={`mt-1.5 min-h-12 w-full rounded-xl border px-3 outline-none focus:ring-2 ${formErrors.ngay_sinh ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'}`}
                    />
                    {formErrors.ngay_sinh
                      ? <span className="mt-1 block text-xs font-medium text-rose-700">{formErrors.ngay_sinh}</span>
                      : <span className="mt-1 block text-xs font-medium text-slate-500">Không chọn ngày trong tương lai hoặc trẻ dưới 30 ngày tuổi.</span>}
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Giới tính
                    <select value={form.gioi_tinh} onChange={(event) => setForm({ ...form, gioi_tinh: event.target.value as typeof form.gioi_tinh })} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                      <option value="">Chưa cập nhật</option>
                      <option value="nam">Nam</option>
                      <option value="nu">Nữ</option>
                      <option value="khac">Khác</option>
                    </select>
                  </label>

                  {accounts.length > 0 && (
                    <label className="md:col-span-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={!linkAccount} onChange={(event) => { setLinkAccount(!event.target.checked); if (event.target.checked) setSelectedAccountId(null) }} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      <span>
                        Không liên kết tài khoản online
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">Dùng khi số điện thoại thuộc người đặt hộ, không phải chủ hồ sơ mới.</span>
                      </span>
                    </label>
                  )}

                  <button type="submit" disabled={saving || (linkAccount && accounts.length > 0 && !selectedAccountId)} className="md:col-span-2 min-h-12 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? 'Đang lưu...' : linkAccount && accounts.length > 0 && !selectedAccountId ? 'Chọn tài khoản trước' : 'Tạo hồ sơ và chọn hồ sơ này'}
                  </button>
                </form>
              </div>
            )}

            {selectedProfile && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-brand-800">Hồ sơ đang thao tác</p>
                      <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedProfile.ho_ten}</h3>
                      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailItem label="Số liên hệ" value={selectedProfile.so_dien_thoai || phone} />
                        <DetailItem label="Ngày sinh" value={`${formatDate(selectedProfile.ngay_sinh)}${age !== null ? ` (${age} tuổi)` : ''}`} />
                        <DetailItem label="Giới tính" value={genderLabel(selectedProfile.gioi_tinh)} />
                        <DetailItem label="Lượt khám" value={lichSuKhamLabel(selectedProfile.lich_su_kham)} />
                      </dl>
                      <p className="mt-3 text-xs text-slate-600">Sửa gần nhất: {suaGanNhatLabel(selectedProfile.sua_gan_nhat)}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedId(null); clearDecision() }} className="min-h-10 rounded-xl border border-brand-300 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-brand-50">
                      Chọn hồ sơ khác
                    </button>
                  </div>
                  {hasActiveQueue && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                      Hồ sơ này đã có lượt đang xử lý hôm nay tại {selectedProfile.luot_dang_cho_hom_nay?.phong_kham || 'phòng khám'}{selectedProfile.luot_dang_cho_hom_nay?.ma_so_thu_tu ? ` - Số thứ tự ${selectedProfile.luot_dang_cho_hom_nay.ma_so_thu_tu}` : ''}.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button type="button" onClick={() => setEditingProfile(selectedProfile)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
                    Chỉnh sửa hồ sơ
                  </button>
                  <button type="button" onClick={() => setAuditProfileId(selectedProfile.id)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
                    Lịch sử đặt lịch
                  </button>
                  {hasAppointmentToday ? (
                    <button type="button" onClick={() => setMode('booked')} className={`min-h-12 rounded-xl px-4 text-sm font-bold ${mode === 'booked' ? 'bg-blue-700 text-white' : 'border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'}`}>
                      Check-in
                    </button>
                  ) : (
                    <button type="button" onClick={loadAvailability} disabled={hasActiveQueue} className={`min-h-12 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${mode === 'walk_in' ? 'bg-brand-700 text-white' : 'border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'}`}>
                      Khám bệnh
                    </button>
                  )}
                </div>

                {mode === 'idle' && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                    Chọn một thao tác bên trên. Màn hình check-in hoặc khám bệnh sẽ mở ngay tại đây để tránh nhiễu thông tin.
                  </div>
                )}

                {mode === 'booked' && hasAppointmentToday && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-base font-bold text-blue-950">Check-in lịch hẹn đã đặt</h4>
                        <p className="mt-1 text-sm text-blue-800">Đối chiếu bác sĩ, phòng khám và trạng thái thanh toán trước khi đưa vào hàng đợi.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-800">{selectedProfile.lich_hen_hom_nay.length} lịch hôm nay</span>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {selectedProfile.lich_hen_hom_nay.map((appointment) => (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => setSelectedAppointmentId(appointment.id)}
                          className={`rounded-xl border bg-white p-4 text-left transition ${selectedAppointmentId === appointment.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-100 hover:border-blue-400'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-bold text-slate-950">{appointment.gio_kham} - {appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</p>
                              <p className="mt-1 text-sm text-slate-600">{appointment.ma_lich_hen || appointment.id}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{appointmentStatusLabel(appointment.status)}</span>
                          </div>
                          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                            <DetailItem label="Chuyên khoa" value={appointment.chuyen_khoa?.ten || 'Chưa có'} />
                            <DetailItem label="Phòng" value={appointment.phong_kham || 'Chưa gán'} />
                            <DetailItem label="Thanh toán" value={paymentLabel(appointment.payment_status)} />
                          </dl>
                        </button>
                      ))}
                    </div>

                    {selectedAppointment && (
                      <button type="button" onClick={checkInBooked} disabled={checkingIn || hasActiveQueue || !appointmentIsCheckinable(selectedAppointment)} className="mt-4 min-h-12 w-full rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {hasActiveQueue ? 'Hồ sơ đã có lượt trong hàng đợi' : !appointmentIsCheckinable(selectedAppointment) ? `Chưa thể check-in ở trạng thái ${appointmentStatusLabel(selectedAppointment.status)}` : checkingIn ? 'Đang check-in...' : `Check-in lịch hẹn ${selectedAppointment.ma_lich_hen || selectedAppointment.gio_kham}`}
                      </button>
                    )}
                  </div>
                )}

                {mode === 'walk_in' && !hasAppointmentToday && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-950">Khám bệnh ngay</h4>
                        <p className="mt-1 text-sm text-slate-600">Chỉ hiển thị bác sĩ/khung khám còn có thể tiếp nhận để lễ tân chọn nhanh.</p>
                      </div>
                      <button type="button" onClick={loadAvailability} disabled={hasActiveQueue} className="min-h-10 rounded-xl border border-brand-300 px-4 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-60">
                        Kiểm tra lại
                      </button>
                    </div>

                    {!availability && (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        Đang chờ dữ liệu lịch làm việc và hàng đợi bác sĩ.
                      </div>
                    )}

                    {availability && (
                      <>
                        <div className={`mt-4 rounded-xl border p-4 ${availabilityTone(availability.trang_thai_kiem_tra)}`}>
                          <p className="font-bold">
                            {availability.trang_thai_kiem_tra === 'co_the_tiep_nhan'
                              ? `${availabilityLabel(availability.trang_thai_kiem_tra)} - ${capacitySummary?.availableDoctors || 0} bác sĩ, còn ${capacitySummary?.availableSlots || 0} suất`
                              : availabilityLabel(availability.trang_thai_kiem_tra)}
                          </p>
                          <p className="mt-1 text-xs opacity-80">Kiểm tra lúc {formatDateTime(availability.checked_at)}</p>
                        </div>

                        {availability.slot_de_xuat && (
                          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
                            <p className="text-sm font-bold text-brand-950">Đề xuất gần nhất</p>
                            <p className="mt-1 text-base font-bold text-slate-950">
                              {availability.minh_chung_suc_chua.find((row) => row.doctor_id === availability.slot_de_xuat?.doctor_id)?.bac_si || 'Bác sĩ đang trực'} - {availability.slot_de_xuat.gio_bat_dau}-{availability.slot_de_xuat.gio_ket_thuc}
                            </p>
                            <p className="mt-1 text-sm text-brand-800">{availability.slot_de_xuat.phong_kham || 'Phòng sẽ được điều phối'} - {availability.ly_do_de_xuat}</p>
                          </div>
                        )}

                        {availability.slots.length > 0 && !hasActiveQueue && (
                          <>
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                              {availability.slots.map((slot) => {
                                const doctor = availability.minh_chung_suc_chua.find((row) => row.doctor_id === slot.doctor_id)
                                return (
                                  <button
                                    key={slot.slot_id}
                                    type="button"
                                    onClick={() => setSelectedSlotId(slot.slot_id)}
                                    className={`rounded-xl border p-4 text-left transition ${selectedSlotId === slot.slot_id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300'}`}
                                  >
                                    <p className="text-base font-bold text-slate-950">{doctor?.bac_si || 'Bác sĩ đang trực'}</p>
                                    <p className="mt-1 text-sm text-slate-600">{slot.gio_bat_dau}-{slot.gio_ket_thuc} - {slot.phong_kham || doctor?.phong_mac_dinh || 'Chưa gán phòng'}</p>
                                    <p className="mt-2 text-xs font-semibold text-slate-500">Đang chờ: {doctor?.dang_cho ?? 0}{doctor && doctor.do_tre_phut > 0 ? ` - trễ ${doctor.do_tre_phut} phút` : ''}</p>
                                  </button>
                                )
                              })}
                            </div>
                            {selectedSlot && (
                              <button type="button" onClick={checkInWalkIn} disabled={checkingIn} className="mt-4 min-h-12 w-full rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {checkingIn ? 'Đang giữ suất khám...' : `Xác nhận khám bệnh cho ${selectedProfile.ho_ten}`}
                              </button>
                            )}
                          </>
                        )}

                        {availability.minh_chung_suc_chua?.length > 0 && (
                          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-sm font-bold text-slate-700">Xem chi tiết tải bác sĩ</summary>
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="min-w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-3 font-bold">Bác sĩ / khung khám</th>
                                    <th className="px-3 py-3 font-bold">Online</th>
                                    <th className="px-3 py-3 font-bold">Walk-in</th>
                                    <th className="px-3 py-3 font-bold">Hàng đợi</th>
                                    <th className="px-3 py-3 font-bold">Đánh giá</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {availability.minh_chung_suc_chua.map((row) => (
                                    <tr key={`${row.schedule_id}-${row.doctor_id}`}>
                                      <td className="px-3 py-3"><p className="font-bold text-slate-800">{row.bac_si}</p><p className="mt-1 text-slate-500">{row.khung_gan_nhat ? `${row.khung_gan_nhat.gio_bat_dau}-${row.khung_gan_nhat.gio_ket_thuc}` : 'Không có khung gần'}</p></td>
                                      <td className="px-3 py-3 text-slate-700">{row.online_da_dat}/{row.tong_slot_trong_khung}</td>
                                      <td className="px-3 py-3"><span className="font-bold text-slate-800">{row.walk_in_con_lai}</span><span className="text-slate-500">/{row.walk_in_tong}</span></td>
                                      <td className="px-3 py-3 text-slate-700">{row.dang_cho} {row.do_tre_phut > 0 ? `(+${row.do_tre_phut}')` : ''}</td>
                                      <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 font-bold ${capacityTone(row)}`}>{capacityLabel(row)}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        )}

                        {availability.goi_y_quay_lai && (
                          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            Có thể tiếp nhận lại: <strong>{availability.goi_y_quay_lai.gio_bat_dau}-{availability.goi_y_quay_lai.gio_ket_thuc}</strong>.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
        ) : (
          <TodayAppointmentTab onTicketReady={setPrintData} />
        )}

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

        <QueueTicketTemplate data={printData} />

        {printData && (
          <div className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
            <span className="text-xs text-slate-600">Phiếu số {printData.queueNumber}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white hover:bg-brand-700"
            >
              In lại phiếu
            </button>
            <button
              type="button"
              onClick={() => setPrintData(null)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Đóng thông báo in phiếu"
            >
              x
            </button>
          </div>
        )}
    </PageShell>
  )
}
