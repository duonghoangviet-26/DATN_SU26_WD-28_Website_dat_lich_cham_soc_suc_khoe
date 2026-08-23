import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CentralOfflineCapacity,
  OnlineAccount,
  PatientProfile,
  TodayAppointment,
  getUnlinkedAccountAppointments,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'
import { SpecialtyOption, specialtyService } from '@/services/specialty.service'
import { receptionistBookingService, DoctorFilterOption, ReceptionistBookingSlot } from '@/services/receptionist-booking.service'
import { receptionistOfflineQueueService, OfflineQueueRow } from '@/services/receptionist-offline-queue.service'
import { appointmentStatusLabel, appointmentStatusTone, paymentLabel, examSessionStatusLabel, examSessionStatusTone, examSessionSourceLabel } from '@/utils/receptionistLabels'
import ProfileAdminEditModal from '@/components/receptionist/ProfileAdminEditModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'
import QueueTicketTemplate, { QueueTicketData } from '@/components/receptionist/QueueTicketTemplate'
import CheckInVerifyModal from '@/components/receptionist/CheckInVerifyModal'
import { PageShell, ReceptionistHeader, StatusBadge } from '@/components/receptionist/ReceptionistUI'
import Pagination from '@/components/common/Pagination'
import axiosInstance from '@/services/axiosInstance'
import {
  getLatestAllowedBirthDateInput,
  normalizePersonName,
  normalizePhoneInput,
  validateBirthDate,
  validatePatientName,
  validateVietnamesePhone,
} from '@/utils/patientIdentityValidation'
import { printTicket } from '@/utils/printTicket'
import { toLocalDateStr } from '@/utils/format'

interface ReceptionistTodayAppointment {
  _id: string
  ngay_kham: string
  gio_kham: string
  status: string
  payment_status: string
  loai_kham?: string
  ly_do_kham?: string | null
  gia_kham?: number | null
  user_id: { ho_ten?: string | null; so_dien_thoai?: string | null } | null
  doctor_id: { _id?: string; user_id?: { ho_ten?: string | null } } | null
  ten_khach?: string | null
  so_dien_thoai_khach?: string | null
  ma_lich_hen?: string | null
  ten_dich_vu?: string | null
  dat_ho?: boolean
  so_lan_doi_khach_yeu_cau?: number
  ly_do_doi?: 'khach_yeu_cau' | 'phong_kham' | 'khach_den_muon' | null
  allowed_actions?: Array<'check_in' | 'reschedule' | 'late_reschedule' | 'cancel'>
  lock_reason?: string | null
  queue_state?: string | null
  sua_gan_nhat?: { nhan: string; thoi_diem: string; nguoi?: { ho_ten?: string | null } } | null
}

interface RescheduleHistoryRow {
  _id: string
  loai_thay_doi: string
  ly_do_thay_doi: string
  thoi_diem: string
}

type LateArrivalPolicy = 'end_of_shift' | 'nearest_available' | 'tomorrow'

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

function appointmentIsCheckinable(appointment: TodayAppointment) {
  return appointment.status === 'confirmed'
}

function hasAppointmentAction(appointment: ReceptionistTodayAppointment, action: 'check_in' | 'reschedule' | 'late_reschedule' | 'cancel') {
  if (Array.isArray(appointment.allowed_actions)) return appointment.allowed_actions.includes(action)
  // Fallback cho dữ liệu cũ chưa có contract allowed_actions từ backend — giống Appointments.tsx.
  if (action === 'check_in') return appointment.status === 'confirmed'
  if (action === 'reschedule') return appointment.status === 'pending' || appointment.status === 'confirmed'
  if (action === 'late_reschedule') return appointment.status === 'confirmed'
  if (action === 'cancel') return appointment.status === 'pending' || appointment.status === 'confirmed'
  return false
}

function isAppointmentOverdue(ngayKham: string, gioKham: string) {
  const dateString = ngayKham.split('T')[0]
  const [year, month, day] = dateString.split('-').map(Number)
  const [hours, minutes] = gioKham.split(':').map(Number)
  const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return appointmentDate < new Date()
}

function isAppointmentToday(ngayKham: string) {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const todayKey = vnNow.toISOString().split('T')[0]
  const apptKey = new Date(ngayKham).toISOString().split('T')[0]
  return apptKey === todayKey
}

type TimeframeFilter = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'past' | 'custom_date' | 'custom_range'
type AppointmentStatusFilter = 'active' | 'pending' | 'confirmed' | 'checked_in' | 'cancelled' | 'all'
type AppointmentPaymentFilter = 'all' | 'unpaid' | 'paid' | 'partial' | 'refunded'

const TIMEFRAME_OPTIONS: Array<{ value: TimeframeFilter; label: string }> = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'tomorrow', label: 'Ngày mai' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'past', label: 'Đã qua' },
  { value: 'custom_date', label: 'Chọn ngày' },
  { value: 'custom_range', label: 'Khoảng ngày' },
]

const STATUS_FILTER_OPTIONS: Array<{ value: AppointmentStatusFilter; label: string }> = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'checked_in', label: 'Đã check-in' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'all', label: 'Tất cả trạng thái' },
]

const PAYMENT_FILTER_OPTIONS: Array<{ value: AppointmentPaymentFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unpaid', label: 'Chưa thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'partial', label: 'Thanh toán một phần' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
]

function AppointmentDetailModal({
  appointment,
  onClose,
  onShowTimeline,
}: {
  appointment: ReceptionistTodayAppointment
  onClose: () => void
  onShowTimeline: () => void
}) {
  const patientName = appointment.user_id?.ho_ten || appointment.ten_khach || 'Khách vãng lai'
  const patientPhone = appointment.user_id?.so_dien_thoai || appointment.so_dien_thoai_khach || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Chi tiết lịch hẹn</h3>
            <p className="mt-1 text-sm text-slate-500">Mã: {appointment.ma_lich_hen || appointment._id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Đóng chi tiết lịch hẹn">
            x
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailItem label="Bệnh nhân" value={patientName} />
          <DetailItem label="Số điện thoại" value={patientPhone} />
          <DetailItem label="Bác sĩ phụ trách" value={appointment.doctor_id?.user_id?.ho_ten} />
          <DetailItem label="Dịch vụ" value={appointment.ten_dich_vu} />
          <DetailItem label="Ngày khám" value={formatDate(appointment.ngay_kham)} />
          <DetailItem label="Giờ khám" value={appointment.gio_kham} />
          <DetailItem label="Giá khám" value={typeof appointment.gia_kham === 'number' ? `${appointment.gia_kham.toLocaleString('vi-VN')} đ` : undefined} />
          <DetailItem label="Loại khám" value={appointment.loai_kham === 'home' ? 'Tại nhà' : 'Tại phòng khám'} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${appointmentStatusTone(appointment.status)}`}>{appointmentStatusLabel(appointment.status)}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{paymentLabel(appointment.payment_status)}</span>
          {appointment.ly_do_doi && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
              Lần dời gần nhất: {appointment.ly_do_doi === 'phong_kham' ? 'lỗi phòng khám' : appointment.ly_do_doi === 'khach_den_muon' ? 'khách đến muộn' : 'khách yêu cầu'}
            </span>
          )}
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lý do khám</h4>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {appointment.ly_do_kham || <span className="italic text-slate-400">Không có ghi chú.</span>}
          </div>
        </div>

        {appointment.lock_reason && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            {appointment.lock_reason}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onShowTimeline} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Xem lịch sử thao tác
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

function AppointmentsTab({
  onTicketReady,
  initialAppointmentId,
  onInitialAppointmentHandled,
}: {
  onTicketReady: (data: QueueTicketData) => void
  initialAppointmentId?: string | null
  onInitialAppointmentHandled?: () => void
}) {
  const [appointments, setAppointments] = useState<ReceptionistTodayAppointment[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  // Mặc định "Hôm nay" — để "Tất cả thời gian" sẽ dồn hết lịch hẹn còn hiệu lực (nhiều ngày)
  // vào một bảng, khó quét bằng mắt. Lễ tân tự đổi sang "Tất cả thời gian" khi cần tra cứu rộng.
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('today')
  const [status, setStatus] = useState<AppointmentStatusFilter>('active')
  const [paymentStatus, setPaymentStatus] = useState<AppointmentPaymentFilter>('all')
  const [doctorId, setDoctorId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [doctors, setDoctors] = useState<DoctorFilterOption[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])
  const [checkInAppointment, setCheckInAppointment] = useState<ReceptionistTodayAppointment | null>(null)
  const [timelineApptId, setTimelineApptId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ReceptionistTodayAppointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<ReceptionistTodayAppointment | null>(null)
  const [rescheduleDoctorId, setRescheduleDoctorId] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<ReceptionistBookingSlot[]>([])
  const [rescheduleReasonText, setRescheduleReasonText] = useState('')
  const [rescheduleLyDo, setRescheduleLyDo] = useState<'khach_yeu_cau' | 'phong_kham'>('khach_yeu_cau')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [limitModalTarget, setLimitModalTarget] = useState<ReceptionistTodayAppointment | null>(null)
  const [limitHistory, setLimitHistory] = useState<RescheduleHistoryRow[]>([])
  const [lateTarget, setLateTarget] = useState<ReceptionistTodayAppointment | null>(null)
  const [latePolicy, setLatePolicy] = useState<LateArrivalPolicy>('nearest_available')
  const [lateReasonText, setLateReasonText] = useState('')
  const [lateSubmitting, setLateSubmitting] = useState(false)
  const [detailAppointment, setDetailAppointment] = useState<ReceptionistTodayAppointment | null>(null)

  useEffect(() => {
    void specialtyService.getAllActive().then((rows) => setSpecialties(rows)).catch(() => setSpecialties([]))
    void receptionistBookingService.listDoctorsForFilter().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDoctorId || !rescheduleDate) {
      setRescheduleSlots([])
      return
    }
    let cancelled = false
    receptionistBookingService.getSlots(rescheduleDoctorId, rescheduleDate)
      .then((slots) => { if (!cancelled) setRescheduleSlots(slots) })
      .catch(() => { if (!cancelled) setRescheduleSlots([]) })
    return () => { cancelled = true }
  }, [rescheduleTarget, rescheduleDoctorId, rescheduleDate])

  // Đến từ link thông báo "Có lịch khám mới!" — tra cứu mã lịch hẹn bằng id rồi CHUYỂN SANG Ô
  // TÌM KIẾM theo mã lịch hẹn (không mở thẳng modal chi tiết) để lễ tân thấy nó lọc RA ĐÚNG 1
  // dòng trong bảng, trong đúng ngữ cảnh danh sách — không phải một popup tách rời. Đồng thời
  // mở hết mọi bộ lọc (thời gian/trạng thái/bác sĩ/chuyên khoa) vì lịch được báo có thể không
  // rơi vào "Hôm nay" (mặc định) hay trạng thái "Đang hoạt động" (mặc định).
  useEffect(() => {
    if (!initialAppointmentId) return
    let cancelled = false
    axiosInstance.get('/receptionist/appointments', { params: { id: initialAppointmentId } })
      .then((response) => {
        if (cancelled) return
        const found = response.data?.success ? (response.data.data ?? [])[0] : null
        if (found?.ma_lich_hen) {
          // Đồng bộ UI bộ lọc cho khớp với những gì sắp hiển thị...
          setTimeframe('all')
          setStatus('all')
          setDoctorId('')
          setSpecialtyId('')
          setCustomDate('')
          setFromDate('')
          setToDate('')
          setQuery(found.ma_lich_hen)
          // ...nhưng KHÔNG chờ effect theo dõi bộ lọc tự chạy lại (nó chỉ chạy khi có giá trị
          // filter nào đó thực sự đổi — nếu lễ tân đã sẵn timeframe/status="all" từ trước thì
          // effect sẽ không bắn, và mỗi ô search một mình không kích hoạt tải lại). Gọi trực
          // tiếp ở đây để CHẮC CHẮN luôn lọc ra đúng lịch hẹn, bất kể trạng thái bộ lọc trước đó.
          void (async () => {
            setLoading(true)
            setError('')
            try {
              const listResponse = await axiosInstance.get('/receptionist/appointments', {
                params: { limit: 10, page: 1, search: found.ma_lich_hen, status: 'all' },
              })
              const rows = Array.isArray(listResponse.data?.data) ? listResponse.data.data : []
              setAppointments(rows)
              setTotalCount(typeof listResponse.data?.pagination?.totalDocs === 'number' ? listResponse.data.pagination.totalDocs : rows.length)
              setTotalPages(typeof listResponse.data?.pagination?.totalPages === 'number' ? listResponse.data.pagination.totalPages : 1)
              setCurrentPage(1)
            } catch (requestError: any) {
              setError(requestError?.response?.data?.message || 'Không thể tải danh sách lịch hẹn')
            } finally {
              setLoading(false)
            }
          })()
        } else {
          setError('Không tìm thấy lịch hẹn từ thông báo này — có thể đã bị hủy hoặc xóa.')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải lịch hẹn từ thông báo này.')
      })
      .finally(() => {
        if (!cancelled) onInitialAppointmentHandled?.()
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAppointmentId])

  const loadAppointments = async (page = currentPage) => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number> = { limit: 10, page }
      if (timeframe === 'today' || timeframe === 'tomorrow' || timeframe === 'upcoming' || timeframe === 'past') {
        params.timeframe = timeframe
      } else if (timeframe === 'custom_date' && customDate) {
        params.date = customDate
      } else if (timeframe === 'custom_range') {
        if (fromDate) params.from_date = fromDate
        if (toDate) params.to_date = toDate
      }
      if (status !== 'active') params.status = status
      if (paymentStatus !== 'all') params.payment_status = paymentStatus
      if (doctorId) params.doctor_id = doctorId
      if (specialtyId) params.specialty_id = specialtyId
      if (query.trim()) params.search = query.trim()

      const response = await axiosInstance.get('/receptionist/appointments', { params })
      const rows = Array.isArray(response.data?.data) ? response.data.data : []
      setAppointments(rows)
      setTotalCount(typeof response.data?.pagination?.totalDocs === 'number' ? response.data.pagination.totalDocs : rows.length)
      setTotalPages(typeof response.data?.pagination?.totalPages === 'number' ? response.data.pagination.totalPages : 1)
      setCurrentPage(page)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách lịch hẹn')
    } finally {
      setLoading(false)
    }
  }

  // Đổi bộ lọc luôn quay về trang 1 — trang 5 của bộ lọc cũ gần như chắc chắn không còn nghĩa
  // với bộ lọc mới.
  useEffect(() => {
    void loadAppointments(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, status, paymentStatus, doctorId, specialtyId, customDate, fromDate, toDate])

  const handlePageChange = (page: number) => {
    void loadAppointments(page)
  }

  const summary = useMemo(() => ({
    waiting: appointments.filter((appointment) => appointment.status === 'confirmed' || appointment.status === 'pending').length,
    checkedIn: appointments.filter((appointment) => appointment.status === 'checked_in').length,
    cancelled: appointments.filter((appointment) => appointment.status === 'cancelled').length,
  }), [appointments])

  const handleCheckedIn = (
    result: { hang_doi: { phong_kham?: string | null; ma_so_thu_tu?: string | null }; canh_bao: string[]; ten_benh_nhan: string },
  ) => {
    if (checkInAppointment) {
      onTicketReady({
        ticketType: 'kham',
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

  const openCancelModal = (appointment: ReceptionistTodayAppointment) => {
    setCancelTarget(appointment)
    setCancelReason('')
  }

  const submitCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) {
      setError('Vui lòng nhập lý do hủy lịch.')
      return
    }
    setCancelSubmitting(true)
    setError('')
    try {
      const response = await axiosInstance.patch(`/receptionist/appointments/${cancelTarget._id}/cancel`, { ly_do_huy: cancelReason.trim() })
      setNotice(response.data?.message || 'Đã hủy lịch hẹn.')
      setCancelTarget(null)
      setCancelReason('')
      void loadAppointments()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể hủy lịch hẹn.')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const startRescheduleModal = (appointment: ReceptionistTodayAppointment, lyDo: 'khach_yeu_cau' | 'phong_kham') => {
    setRescheduleTarget(appointment)
    setRescheduleDoctorId(appointment.doctor_id?._id || '')
    setRescheduleDate(appointment.ngay_kham.split('T')[0])
    setRescheduleTime('')
    setRescheduleReasonText('')
    setRescheduleLyDo(lyDo)
  }

  const openRescheduleFlow = async (appointment: ReceptionistTodayAppointment) => {
    const hetLuot = (appointment.so_lan_doi_khach_yeu_cau || 0) >= 1
    if (hetLuot) {
      setError('')
      try {
        const response = await axiosInstance.get(`/receptionist/appointments/${appointment._id}/reschedule-history`)
        setLimitHistory(response.data?.data || [])
        setLimitModalTarget(appointment)
      } catch {
        setError('Không thể tải lịch sử dời lịch.')
      }
      return
    }
    startRescheduleModal(appointment, 'khach_yeu_cau')
  }

  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime || !rescheduleReasonText.trim()) {
      setError('Vui lòng chọn ngày, giờ và nhập lý do dời lịch.')
      return
    }
    const targetDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`)
    if (targetDateTime <= new Date()) {
      setError('Không thể dời lịch về quá khứ. Vui lòng chọn thời gian trong tương lai.')
      return
    }
    setRescheduleSubmitting(true)
    setError('')
    try {
      const response = await axiosInstance.patch(`/receptionist/appointments/${rescheduleTarget._id}/reschedule`, {
        ngay_kham: rescheduleDate,
        gio_kham: rescheduleTime,
        ly_do_doi_lich: rescheduleReasonText.trim(),
        ly_do_doi: rescheduleLyDo,
      })
      setNotice(response.data?.message || 'Đã dời lịch hẹn.')
      setRescheduleTarget(null)
      void loadAppointments()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể dời lịch hẹn.')
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const openLateArrivalFlow = (appointment: ReceptionistTodayAppointment) => {
    setLateTarget(appointment)
    setLatePolicy('nearest_available')
    setLateReasonText('Khách đến muộn, lễ tân điều phối lại slot.')
  }

  const submitLateArrival = async () => {
    if (!lateTarget) return
    setLateSubmitting(true)
    setError('')
    try {
      const response = await axiosInstance.patch(`/receptionist/appointments/${lateTarget._id}/mark-late`, {
        policy: latePolicy,
        reason: lateReasonText,
      })
      setNotice(response.data?.message || 'Đã xử lý khách đến muộn.')
      setLateTarget(null)
      void loadAppointments()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể xử lý khách đến muộn.')
    } finally {
      setLateSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Lịch hẹn</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Mặc định chỉ hiển thị lịch hẹn hôm nay. Dùng bộ lọc bên dưới để xem ngày khác hoặc tra cứu rộng hơn.
          </p>
        </div>
        <button type="button" onClick={() => void loadAppointments(currentPage)} disabled={loading} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Kết quả</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{totalCount}</p>
          {totalPages > 1 && (
            <p className="mt-1 text-[11px] font-medium text-slate-500">Trang {currentPage}/{totalPages} — 10 lịch hẹn/trang.</p>
          )}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">Chưa đến</p>
          <p className="mt-1 text-xl font-bold text-amber-950">{summary.waiting}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Đã check-in</p>
          <p className="mt-1 text-xl font-bold text-emerald-950">{summary.checkedIn}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-700">Đã hủy</p>
          <p className="mt-1 text-xl font-bold text-rose-950">{summary.cancelled}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Chưa đến / Đã check-in / Đã hủy chỉ đếm trong trang đang xem, không phải toàn bộ kết quả.</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        <label className="text-xs font-bold text-slate-600">
          Thời gian
          <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {TIMEFRAME_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatusFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {STATUS_FILTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Thanh toán
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as AppointmentPaymentFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {PAYMENT_FILTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Bác sĩ
          <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">Tất cả bác sĩ</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.ho_ten}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Chuyên khoa
          <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">Tất cả chuyên khoa</option>
            {specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.ten}</option>)}
          </select>
        </label>
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void loadAppointments(1) }}>
          <label className="flex-1 text-xs font-bold text-slate-600">
            Tìm kiếm
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mã lịch, tên, SĐT"
              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-brand-700 px-3 text-sm font-bold text-white hover:bg-brand-800">Tìm</button>
        </form>
      </div>

      {timeframe === 'custom_date' && (
        <div className="mt-3">
          <label className="text-xs font-bold text-slate-600">
            Chọn ngày
            <input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
        </div>
      )}
      {timeframe === 'custom_range' && (
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs font-bold text-slate-600">
            Từ ngày
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Đến ngày
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
        </div>
      )}

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
                <th className="px-4 py-3">Ngày / giờ</th>
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
              ) : appointments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Không có lịch hẹn phù hợp.</td></tr>
              ) : appointments.map((appointment) => {
                const patientName = appointment.user_id?.ho_ten || appointment.ten_khach || 'Khách vãng lai'
                const patientPhone = appointment.user_id?.so_dien_thoai || appointment.so_dien_thoai_khach || ''
                const canCheckIn = hasAppointmentAction(appointment, 'check_in')
                const isToday = isAppointmentToday(appointment.ngay_kham)
                const isOverdue = isAppointmentOverdue(appointment.ngay_kham, appointment.gio_kham)
                const canLate = isToday && isOverdue && hasAppointmentAction(appointment, 'late_reschedule')
                const canReschedule = hasAppointmentAction(appointment, 'reschedule')
                const canCancel = hasAppointmentAction(appointment, 'cancel')
                const noActionsAvailable = !canCheckIn && !canLate && !canReschedule && !canCancel
                return (
                  <tr key={appointment._id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold tabular-nums text-slate-950">{formatDate(appointment.ngay_kham)} - {appointment.gio_kham}</p>
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
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canCheckIn && (
                          <button
                            type="button"
                            onClick={() => setCheckInAppointment(appointment)}
                            disabled={!patientPhone || !isToday}
                            className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title={!patientPhone ? 'Lịch chưa có số điện thoại để xác minh hồ sơ' : !isToday ? 'Chỉ có thể check-in lịch hẹn của hôm nay' : undefined}
                          >
                            Check-in
                          </button>
                        )}
                        {canLate && (
                          <button type="button" onClick={() => openLateArrivalFlow(appointment)} className="min-h-9 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700">
                            Đến muộn
                          </button>
                        )}
                        {canReschedule && (
                          <button type="button" onClick={() => void openRescheduleFlow(appointment)} className="min-h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100">
                            Dời lịch
                          </button>
                        )}
                        {canCancel && (
                          <button type="button" onClick={() => openCancelModal(appointment)} className="min-h-9 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100">
                            Hủy lịch
                          </button>
                        )}
                        <button type="button" onClick={() => setDetailAppointment(appointment)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          Chi tiết
                        </button>
                        <button type="button" onClick={() => setTimelineApptId(appointment._id)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          Lịch sử
                        </button>
                        {noActionsAvailable && appointment.lock_reason && (
                          <span className="max-w-[200px] self-center truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600" title={appointment.lock_reason}>
                            {appointment.lock_reason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {checkInAppointment && (
        <CheckInVerifyModal
          appointmentId={checkInAppointment._id}
          maLichHen={checkInAppointment.ma_lich_hen}
          searchPhone={checkInAppointment.user_id?.so_dien_thoai || checkInAppointment.so_dien_thoai_khach || ''}
          onClose={() => setCheckInAppointment(null)}
          onCheckedIn={handleCheckedIn}
        />
      )}

      {detailAppointment && (
        <AppointmentDetailModal
          appointment={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onShowTimeline={() => {
            setTimelineApptId(detailAppointment._id)
            setDetailAppointment(null)
          }}
        />
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Hủy lịch hẹn</h3>
            <p className="mt-1 text-sm text-slate-500">
              {cancelTarget.ma_lich_hen || cancelTarget._id} · {cancelTarget.user_id?.ho_ten || cancelTarget.ten_khach || 'Khách vãng lai'}
            </p>
            <label className="mt-4 block text-xs font-bold text-slate-600">
              Lý do hủy
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                placeholder="Vd: khách yêu cầu hủy, không liên lạc được..."
                className="mt-1 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCancelTarget(null)} disabled={cancelSubmitting} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">
                Quay lại
              </button>
              <button type="button" onClick={submitCancel} disabled={cancelSubmitting || !cancelReason.trim()} className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                {cancelSubmitting ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Dời lịch hẹn</h3>
            <p className="mt-1 text-sm text-slate-500">
              {rescheduleTarget.ma_lich_hen || rescheduleTarget._id} · {rescheduleTarget.user_id?.ho_ten || rescheduleTarget.ten_khach || 'Khách vãng lai'}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                Dời theo yêu cầu của ai?
                <select
                  value={rescheduleLyDo}
                  onChange={(event) => setRescheduleLyDo(event.target.value as 'khach_yeu_cau' | 'phong_kham')}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="khach_yeu_cau">Khách yêu cầu — tính vào hạn mức 1 lần</option>
                  <option value="phong_kham">Lỗi phòng khám — không tính hạn mức</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Ngày khám mới
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Giờ khám mới
                <select
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">-- Chọn giờ khám --</option>
                  {rescheduleSlots.map((slot) => (
                    <option key={slot.id} value={slot.gio_bat_dau}>{slot.gio_bat_dau} - {slot.gio_ket_thuc}</option>
                  ))}
                </select>
                {rescheduleSlots.length === 0 && <span className="mt-1 block text-xs text-amber-600">Không có khung giờ trống trong ngày này.</span>}
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Lý do dời lịch
                <textarea
                  value={rescheduleReasonText}
                  onChange={(event) => setRescheduleReasonText(event.target.value)}
                  rows={3}
                  placeholder="Nhập lý do dời lịch..."
                  className="mt-1 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRescheduleTarget(null)} disabled={rescheduleSubmitting} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">
                Hủy bỏ
              </button>
              <button type="button" onClick={submitReschedule} disabled={rescheduleSubmitting} className="min-h-10 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
                {rescheduleSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {limitModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-rose-600">Khách đã dùng hết lượt dời lịch</h3>
            <p className="mt-2 text-sm text-slate-600">
              Khách hàng này đã tự xin dời 1 lần — hết hạn mức. Nếu lần này là lỗi phòng khám (bác sĩ nghỉ, bận đột xuất, sự cố thiết bị) thì vẫn dời được và không tính vào hạn mức của khách.
            </p>
            <div className="mt-4 max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              {limitHistory.length === 0 ? (
                <p className="text-sm italic text-slate-500">Không có dữ liệu lịch sử cũ.</p>
              ) : limitHistory.map((history, index) => (
                <div key={history._id} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Lần {index + 1}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(history.thoi_diem)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">Lý do: {history.ly_do_thay_doi}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setLimitModalTarget(null)} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Đóng thông báo
              </button>
              <button
                type="button"
                onClick={() => {
                  const appointment = limitModalTarget
                  setLimitModalTarget(null)
                  if (appointment) startRescheduleModal(appointment, 'phong_kham')
                }}
                className="min-h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Dời do lỗi phòng khám
              </button>
            </div>
          </div>
        </div>
      )}

      {lateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Xử lý khách đến muộn</h3>
            <p className="mt-1 text-sm text-slate-500">
              Lịch {lateTarget.ma_lich_hen || lateTarget._id} lúc {lateTarget.gio_kham} đã quá giờ.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                Cách điều phối
                <select
                  value={latePolicy}
                  onChange={(event) => setLatePolicy(event.target.value as LateArrivalPolicy)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="nearest_available">Slot trống gần nhất trong ngày</option>
                  <option value="end_of_shift">Đưa xuống cuối ca hiện tại</option>
                  <option value="tomorrow">Đổi sang ngày làm việc tiếp theo</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Ghi chú cho khách hàng
                <textarea
                  value={lateReasonText}
                  onChange={(event) => setLateReasonText(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setLateTarget(null)} disabled={lateSubmitting} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">
                Hủy bỏ
              </button>
              <button type="button" onClick={submitLateArrival} disabled={lateSubmitting} className="min-h-10 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">
                {lateSubmitting ? 'Đang xử lý...' : 'Xác nhận điều phối'}
              </button>
            </div>
          </div>
        </div>
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

type SessionStatusFilter = 'all' | 'cho_dieu_phoi' | 'dang_cho' | 'da_goi' | 'trong_phong' | 'hoan_thanh' | 'cancelled'
type SessionSourceFilter = 'all' | 'online' | 'offline'

const SESSION_STATUS_OPTIONS: Array<{ value: SessionStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'cho_dieu_phoi', label: 'Chờ điều phối' },
  { value: 'dang_cho', label: 'Đang chờ gọi' },
  { value: 'da_goi', label: 'Đã gọi' },
  { value: 'trong_phong', label: 'Đang khám' },
  { value: 'hoan_thanh', label: 'Đã khám xong' },
  { value: 'cancelled', label: 'Đã hủy / bỏ qua' },
]

// Đổi tên từ "Ca khám hôm nay": trước đây khoá cứng ngày hôm nay, nay thêm ô chọn ngày (mặc định
// hôm nay, giống pattern DoctorExamHistory.tsx) để lễ tân tra cứu lại bất kỳ ngày nào đã ghi nhận.
function ExamSessionsHistoryTab() {
  const [rows, setRows] = useState<OfflineQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState(toLocalDateStr())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<SessionStatusFilter>('all')
  const [source, setSource] = useState<SessionSourceFilter>('all')
  const [doctorId, setDoctorId] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [doctors, setDoctors] = useState<DoctorFilterOption[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])

  useEffect(() => {
    void specialtyService.getAllActive().then((items) => setSpecialties(items)).catch(() => setSpecialties([]))
    void receptionistBookingService.listDoctorsForFilter().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const statusParam = status === 'cancelled' ? 'cancelled,skipped' : status === 'all' ? undefined : status
      const rows = await receptionistOfflineQueueService.listSessions({
        date,
        status: statusParam,
        nguon: source === 'all' ? undefined : source,
        doctor_id: doctorId || undefined,
        specialty_id: specialtyId || undefined,
        search: query.trim() || undefined,
      })
      setRows(rows)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách ca khám')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, status, source, doctorId, specialtyId])

  const isToday = date === toLocalDateStr()

  const summary = useMemo(() => ({
    total: rows.length,
    waiting: rows.filter((row) => ['cho_dieu_phoi', 'dang_cho', 'da_goi'].includes(row.trang_thai)).length,
    inRoom: rows.filter((row) => row.trang_thai === 'trong_phong').length,
    done: rows.filter((row) => row.trang_thai === 'hoan_thanh').length,
  }), [rows])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Danh sách đã khám</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Toàn bộ ca khám đã ghi nhận theo ngày, gồm cả lượt đặt online lẫn khách đến trực tiếp tại quầy. Chọn ngày để xem lại các ca trước đó.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Tổng số ca</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">Đang chờ</p>
          <p className="mt-1 text-xl font-bold text-amber-950">{summary.waiting}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-700">Đang khám</p>
          <p className="mt-1 text-xl font-bold text-brand-950">{summary.inRoom}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Đã khám xong</p>
          <p className="mt-1 text-xl font-bold text-emerald-950">{summary.done}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        <label className="text-xs font-bold text-slate-600">
          Ngày khám
          <div className="mt-1 flex gap-1.5">
            <input
              type="date"
              value={date}
              max={toLocalDateStr()}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {!isToday && (
              <button type="button" onClick={() => setDate(toLocalDateStr())} title="Về hôm nay"
                className="min-h-10 shrink-0 rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Hôm nay
              </button>
            )}
          </div>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value as SessionStatusFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            {SESSION_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Nguồn
          <select value={source} onChange={(event) => setSource(event.target.value as SessionSourceFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="all">Tất cả nguồn</option>
            <option value="online">Online</option>
            <option value="offline">Tại quầy</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Bác sĩ
          <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">Tất cả bác sĩ</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.ho_ten}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Chuyên khoa
          <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">Tất cả chuyên khoa</option>
            {specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.ten}</option>)}
          </select>
        </label>
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void load() }}>
          <label className="flex-1 text-xs font-bold text-slate-600">
            Tìm kiếm
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên, SĐT, mã lượt khám"
              className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-brand-700 px-3 text-sm font-bold text-white hover:bg-brand-800">Tìm</button>
        </form>
      </div>

      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">{error}</p>}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Số / bệnh nhân</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Chuyên khoa</th>
                <th className="px-4 py-3">Bác sĩ / phòng</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải ca khám...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Không có ca khám phù hợp.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{row.ma_so_thu_tu || '-'}</p>
                    <p className="mt-1 font-semibold text-slate-900">{row.ten_benh_nhan}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.so_dien_thoai || 'Chưa có SĐT'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{examSessionSourceLabel(row.nguon || 'offline')}</td>
                  <td className="px-4 py-3 text-slate-700">{row.specialty?.ten || '-'}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.doctor?.ho_ten || 'Chưa gán'}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.phong_kham || row.doctor?.phong_kham_mac_dinh || '-'}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={examSessionStatusTone(row.trang_thai)}>{examSessionStatusLabel(row.trang_thai)}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

function BookingHistoryModal({ profile, onClose }: { profile: PatientProfile; onClose: () => void }) {
  const [appointments, setAppointments] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    receptionistPatientIntakeService.getBookingHistory(profile.id)
      .then((result) => {
        if (!cancelled) setAppointments(result.appointments || [])
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải lịch sử đặt lịch')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Lịch sử đặt lịch</h3>
            <p className="mt-1 text-sm text-slate-500">{profile.ho_ten}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Đóng lịch sử đặt lịch">
            x
          </button>
        </div>

        {loading && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Đang tải lịch sử đặt lịch...
          </div>
        )}
        {!loading && error && <p className="mt-6 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {!loading && !error && appointments.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Hồ sơ này chưa có lịch đặt nào.
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ngày giờ</th>
                  <th className="px-4 py-3">Mã lịch</th>
                  <th className="px-4 py-3">Bác sĩ / chuyên khoa</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thanh toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-950">{formatDate(appointment.ngay_kham)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{appointment.gio_kham}{appointment.gio_ket_thuc ? ` - ${appointment.gio_ket_thuc}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-700">{appointment.ma_lich_hen || appointment.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{appointment.nguon === 'tai_cho' ? 'Tại quầy' : 'Online'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{appointment.doctor?.ho_ten || 'Chưa gán bác sĩ'}</p>
                      <p className="mt-1 text-xs text-slate-500">{appointment.chuyen_khoa?.ten || 'Chưa có chuyên khoa'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${appointmentStatusTone(appointment.status)}`}>
                        {appointmentStatusLabel(appointment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{paymentLabel(appointment.payment_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Đóng
          </button>
        </div>
      </div>
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
  const [centralCapacity, setCentralCapacity] = useState<CentralOfflineCapacity | null>(null)
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([])
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('')
  const [confirmLongWait, setConfirmLongWait] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PatientProfile | null>(null)
  const [bookingHistoryProfile, setBookingHistoryProfile] = useState<PatientProfile | null>(null)
  const [linkAccount, setLinkAccount] = useState(true)
  const [printData, setPrintData] = useState<QueueTicketData | null>(null)
  const [searchPhoneError, setSearchPhoneError] = useState('')
  const [formErrors, setFormErrors] = useState<{ ho_ten?: string; ngay_sinh?: string }>({})
  const [workspaceTab, setWorkspaceTab] = useState<'lookup' | 'appointments' | 'today_sessions'>('lookup')
  // D81 — modal tự trị, không đụng state tra cứu-theo-SĐT ở trên.
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null)

  useEffect(() => {
    if (printData) printTicket()
  }, [printData])

  // Đến từ link trong thông báo "Có lịch khám mới!" (?tab=appointments&appointment_id=<id>) —
  // phải mở đúng trang "Tiếp nhận & lịch hẹn" (menu hiện dùng), KHÔNG phải trang
  // /receptionist/appointments cũ đã bỏ khỏi sidebar.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const appointmentId = searchParams.get('appointment_id')
    if (!tab && !appointmentId) return
    if (tab === 'appointments') setWorkspaceTab('appointments')
    if (appointmentId) setPendingAppointmentId(appointmentId)
    setSearchParams((params) => {
      params.delete('tab')
      params.delete('appointment_id')
      return params
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null
  const selectedAppointment = selectedProfile?.lich_hen_hom_nay.find((appointment) => appointment.id === selectedAppointmentId) ?? null
  const hasAppointmentToday = Boolean(selectedProfile?.lich_hen_hom_nay.length)
  const hasActiveQueue = Boolean(selectedProfile?.luot_dang_cho_hom_nay)
  const unlinkedAccountAppointments = getUnlinkedAccountAppointments(profiles, accountAppointments)

  const latestAllowedBirthDateInput = getLatestAllowedBirthDateInput()

  const clearDecision = () => {
    setCentralCapacity(null)
    setSelectedSpecialtyId('')
    setConfirmLongWait(false)
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
    setCentralCapacity(null)
    setConfirmLongWait(false)
    try {
      const specialtyRows = specialties.length ? specialties : await specialtyService.getAllActive()
      setSpecialties(specialtyRows)
      const specialtyId = selectedSpecialtyId || specialtyRows[0]?.id || ''
      setSelectedSpecialtyId(specialtyId)
      if (!specialtyId) {
        setMessage('Chưa có chuyên khoa đang hoạt động để tiếp nhận khách vãng lai.')
        return
      }
      const result = await receptionistPatientIntakeService.getCentralOfflineCapacity(specialtyId)
      setCentralCapacity(result)
      if (!result.co_the_nhan) setMessage(result.ly_do || 'Tạm dừng nhận khách vãng lai cho chuyên khoa này.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể xác minh sức chứa hàng đợi trung tâm.')
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
        ticketType: 'kham',
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
        ticketType: 'kham',
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
    if (!selectedProfile || !selectedSpecialtyId || !centralCapacity) return
    setCheckingIn(true)
    setError('')
    try {
      const result = await receptionistPatientIntakeService.intakeCentralOffline({
        ho_so_benh_nhan_id: selectedProfile.id,
        specialty_id: selectedSpecialtyId,
        xac_nhan_canh_bao: confirmLongWait,
      })
      setCentralCapacity(null)
      setConfirmLongWait(false)
      setMessage(`Đã tiếp nhận walk-in ${selectedProfile.ho_ten} vào hàng đợi khám. Số thứ tự: ${result.entry.ma_so_thu_tu || result.entry._id}`)
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id
        ? { ...profile, luot_dang_cho_hom_nay: { id: result.entry._id, trang_thai: 'cho_dieu_phoi', specialty_id: selectedSpecialtyId, doctor_id: null, phong_kham: null, checkin_time: result.entry.checkin_time || new Date().toISOString(), so_thu_tu_checkin: result.entry.so_thu_tu_checkin, ma_so_thu_tu: result.entry.ma_so_thu_tu } }
        : profile))

      const specialtyName = specialties.find((item) => item.id === selectedSpecialtyId)?.ten
      setPrintData({
        ticketType: 'cho_dieu_phoi',
        patientName: selectedProfile.ho_ten,
        queueNumber: result.entry.ma_so_thu_tu || '-',
        specialtyName,
        appointmentTime: formatDateTime(result.entry.checkin_time ?? new Date().toISOString()),
        note: result.entry.thoi_gian_cho_uoc_tinh_phut
          ? `Thời gian chờ ước tính: ${result.entry.thoi_gian_cho_uoc_tinh_phut} phút. Vui lòng chờ lễ tân điều phối bác sĩ phù hợp.`
          : 'Vui lòng chờ lễ tân điều phối bác sĩ phù hợp.',
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
  const selectedSpecialtyName = specialties.find((item) => item.id === selectedSpecialtyId)?.ten

  return (
    <PageShell>
        <ReceptionistHeader
          eyebrow="Tiếp nhận & lịch hẹn"
          title="Tiếp nhận tại quầy"
          description="Quản lý tra cứu hồ sơ, tiếp nhận khách đến trực tiếp, theo dõi lịch hẹn và ca khám trong ngày."
        />

        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
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
              onClick={() => setWorkspaceTab('appointments')}
              className={`min-h-12 rounded-xl px-4 text-left text-sm font-bold transition ${workspaceTab === 'appointments' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              Lịch hẹn
              <span className={`mt-0.5 block text-xs font-medium ${workspaceTab === 'appointments' ? 'text-slate-200' : 'text-slate-500'}`}>Xem và lọc toàn bộ lịch hẹn, không chỉ trong hôm nay</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('today_sessions')}
              className={`min-h-12 rounded-xl px-4 text-left text-sm font-bold transition ${workspaceTab === 'today_sessions' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              Danh sách đã khám
              <span className={`mt-0.5 block text-xs font-medium ${workspaceTab === 'today_sessions' ? 'text-slate-200' : 'text-slate-500'}`}>Toàn bộ ca khám đã ghi nhận, xem lại theo từng ngày</span>
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
        <div className="grid gap-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
            <StepIndicator step={1} label="Tra số điện thoại" state={lookupState} />
            <StepIndicator step={2} label="Chọn hồ sơ" state={profileState} />
            <StepIndicator step={3} label="Khám/Check-in" state={actionState} />
          </div>
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
                      <h3 className="mt-1 text-xl font-bold text-slate-950">
                        {selectedProfile.ho_ten}
                      </h3>
                      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailItem
                          label="Số liên hệ"
                          value={selectedProfile.so_dien_thoai || phone}
                        />
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
                  <button type="button" onClick={() => setBookingHistoryProfile(selectedProfile)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
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
                        <h4 className="text-base font-bold text-slate-950">Khách vãng lai - hàng đợi trung tâm</h4>
                        <p className="mt-1 text-sm text-slate-600">Hệ thống dùng chuyên khoa mặc định của phòng khám, kiểm tra sức chứa, rồi đưa khách vào hàng đợi chờ điều phối bác sĩ.</p>
                      </div>
                      <button type="button" onClick={loadAvailability} disabled={hasActiveQueue} className="min-h-10 rounded-xl border border-brand-300 px-4 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-60">
                        Kiểm tra lại
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">Chuyên khoa áp dụng</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selectedSpecialtyName || 'Đang xác định chuyên khoa mặc định'}</p>
                    </div>

                    {!centralCapacity && (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        Bấm kiểm tra lại để tải sức chứa hàng đợi trung tâm.
                      </div>
                    )}

                    {centralCapacity && (
                      <>
                        <div className={`mt-4 rounded-xl border p-4 ${
                          centralCapacity.trang_thai === 'co_the_nhan'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                            : centralCapacity.trang_thai === 'canh_bao_day'
                              ? 'border-amber-200 bg-amber-50 text-amber-950'
                              : 'border-rose-200 bg-rose-50 text-rose-950'
                        }`}>
                          <p className="font-bold">
                            {centralCapacity.trang_thai === 'co_the_nhan'
                              ? 'Có thể tiếp nhận'
                              : centralCapacity.trang_thai === 'canh_bao_day'
                                ? 'Hàng đợi đang đầy - cần báo trước với khách'
                                : 'Tạm dừng tiếp nhận'}
                          </p>
                          {centralCapacity.ly_do && <p className="mt-1 text-sm">{centralCapacity.ly_do}</p>}
                          <p className="mt-2 text-xs opacity-80">Kiểm tra lúc {formatDateTime(centralCapacity.checked_at)}</p>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">Đang chờ trung tâm</p>
                            <p className="mt-1 text-xl font-bold text-slate-950">{centralCapacity.thong_ke.so_khach_cho_trung_tam}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">Bác sĩ có thể điều phối</p>
                            <p className="mt-1 text-xl font-bold text-slate-950">{centralCapacity.thong_ke.so_bac_si_co_the_dieu_phoi}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">Chờ ước tính</p>
                            <p className="mt-1 text-xl font-bold text-slate-950">{centralCapacity.thong_ke.thoi_gian_cho_uoc_tinh_phut ?? '-'}'</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">Còn nhận</p>
                            <p className="mt-1 text-xl font-bold text-slate-950">{centralCapacity.thong_ke.suc_chua_trung_tam_con_lai}</p>
                          </div>
                        </div>

                        {centralCapacity.can_xac_nhan_qua_tai && (
                          <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                            <input
                              type="checkbox"
                              checked={confirmLongWait}
                              onChange={(event) => setConfirmLongWait(event.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-500"
                            />
                            <span>Đã thông báo thời gian chờ ước tính cho khách và khách đồng ý tiếp tục chờ điều phối.</span>
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={checkInWalkIn}
                          disabled={checkingIn || hasActiveQueue || !centralCapacity.co_the_nhan || (centralCapacity.can_xac_nhan_qua_tai && !confirmLongWait)}
                          className="mt-4 min-h-12 w-full rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {checkingIn
                            ? 'Đang đưa vào hàng đợi...'
                            : `Đưa ${selectedProfile.ho_ten} vào hàng đợi trung tâm`}
                        </button>
                      </>
                    )}
                  </div>
                )}

              </div>
            )}
          </section>
        </main>
        </div>
        ) : workspaceTab === 'appointments' ? (
          <AppointmentsTab
            onTicketReady={setPrintData}
            initialAppointmentId={pendingAppointmentId}
            onInitialAppointmentHandled={() => setPendingAppointmentId(null)}
          />
        ) : (
          <ExamSessionsHistoryTab />
        )}

        {editingProfile && (
          <ProfileAdminEditModal
            profile={editingProfile}
            onClose={() => setEditingProfile(null)}
            onSaved={handleProfileSaved}
          />
        )}
        {bookingHistoryProfile && (
          <BookingHistoryModal
            profile={bookingHistoryProfile}
            onClose={() => setBookingHistoryProfile(null)}
          />
        )}

        <QueueTicketTemplate data={printData} />

        {printData && (
          <div className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
            <span className="text-xs text-slate-600">Phiếu số {printData.queueNumber}</span>
            <button
              type="button"
              onClick={() => printTicket()}
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
