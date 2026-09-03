import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'

import { Star } from 'lucide-react'
import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Modal from '@/components/common/Modal'
import Toast from '@/components/common/Toast'
import Pagination from '@/components/common/Pagination'
import RescheduleModal from '@/components/client/RescheduleModal'
import ReviewModal from '@/components/client/ReviewModal'
import { ContentTransition, RouteTransition } from '@/components/client/ClientMotion'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'
import { resolveMediaUrl } from '@/utils/media'
import {
  getLatestAllowedBirthDateInput,
  normalizePersonName,
  normalizePhoneInput,
  validateBirthDate,
  validatePatientName,
  validateVietnamesePhone,
} from '@/utils/patientIdentityValidation'
import {
  patientRecordsService,
  type PatientRecordDetail,
  type PatientRecordListItem,
  type MedicalResultItem,
} from '@/services/patient-records.service'
import {
  patientBookingService,
  type PatientPaymentStatusResult,
  type FamilyGroup,
  type FamilyMember,
} from '@/services/patient-booking.service'
import {
  patientReviewService,
  type PendingReviewAppointment,
  type MyReviewItem,
} from '@/services/patient-review.service'
import { followupService, type FollowUpRecord } from '@/services/followup.service'

export default function Profile() {
  const { user, loading: authLoading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const justBooked = searchParams.get('booked') === 'true'

  const [activeTab, setActiveTab] = useState<'appointments' | 'results' | 'account' | 'family' | 'reviews' | 'followups'>('appointments')
  const [appointments, setAppointments] = useState<PatientRecordListItem[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)

  // Review states
  const [pendingReviews, setPendingReviews] = useState<PendingReviewAppointment[]>([])
  const [myReviews, setMyReviews] = useState<MyReviewItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotalPages, setReviewTotalPages] = useState(1)
  const [selectedReviewApp, setSelectedReviewApp] = useState<PendingReviewAppointment | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)

  // Lọc và phân trang lịch hẹn
  const [appCurrentPage, setAppCurrentPage] = useState(1)
  const [appSearchDoctor, setAppSearchDoctor] = useState('')
  const [appStartDate, setAppStartDate] = useState('')
  const [appEndDate, setAppEndDate] = useState('')
  const [appPatientFilter, setAppPatientFilter] = useState('all')
  const ITEMS_PER_PAGE = 5

  // Medical results states
  const [medicalResults, setMedicalResults] = useState<MedicalResultItem[]>([])
  const [medicalResultsLoading, setMedicalResultsLoading] = useState(false)
  const [resultsCurrentPage, setResultsCurrentPage] = useState(1)
  const [resultsTotalPages, setResultsTotalPages] = useState(1)
  const [resultsStartDate, setResultsStartDate] = useState('')
  const [resultsEndDate, setResultsEndDate] = useState('')
  const [resultsPatientFilter, setResultsPatientFilter] = useState('all')
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(new Set())

  // Followups states
  const [followups, setFollowups] = useState<FollowUpRecord[]>([])
  const [followupsLoading, setFollowupsLoading] = useState(false)

  const fetchFollowups = () => {
    setFollowupsLoading(true)
    followupService.getMyFollowUps()
      .then((data) => setFollowups(Array.isArray(data) ? data : []))
      .catch((err: any) => console.error('Lỗi tải tái khám', err))
      .finally(() => setFollowupsLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'followups' && user) {
      fetchFollowups()
    }
  }, [activeTab, user])

  function hasVitalsData(sh?: any) {
    if (!sh) return false
    return (
      sh.nhip_tim != null ||
      (sh.huyet_ap != null && String(sh.huyet_ap).trim() !== '') ||
      sh.nhiet_do != null ||
      sh.can_nang != null ||
      sh.chieu_cao != null
    )
  }

  function calculateAge(dateStr?: string | null) {
    if (!dateStr) return null
    const dob = new Date(dateStr)
    if (isNaN(dob.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    const m = now.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
      age--
    }
    if (age <= 0) {
      const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
      return months > 0 ? `${months} tháng tuổi` : 'Dưới 1 tháng tuổi'
    }
    return `${age} tuổi`
  }

  function getQuanHeEmoji(quanHe?: string | null) {
    switch (quanHe) {
      case 'con': return '👶'
      case 'me': return '👵'
      case 'cha': return '👴'
      case 'vo': return '👩'
      case 'chong': return '👨'
      case 'anh_chi_em': return '🧑'
      case 'ban_than': return '👤'
      default: return '🧑'
    }
  }

  function formatQuanHeLabel(quanHe: string) {
    switch (quanHe) {
      case 'con': return 'Con'
      case 'me': return 'Mẹ'
      case 'cha': return 'Bố / Cha'
      case 'vo': return 'Vợ'
      case 'chong': return 'Chồng'
      case 'anh_chi_em': return 'Anh / Chị / Em'
      case 'ban_than': return 'Bản thân'
      default: return 'Thành viên'
    }
  }

  function matchPatientFilter(
    item: { ho_so_benh_nhan_id?: string | null; member_id?: string | null; ten_khach?: string | null },
    filterValue: string,
    selfName: string,
    ownerMemberId?: string | null
  ) {
    if (!filterValue || filterValue === 'all') return true

    if (filterValue === 'self') {
      if (ownerMemberId && item.member_id === ownerMemberId) return true
      return !item.member_id && (!item.ten_khach || item.ten_khach.trim().toLowerCase() === selfName.trim().toLowerCase())
    }

    if (filterValue.startsWith('member:')) {
      const targetMemberId = filterValue.replace('member:', '')
      return item.member_id === targetMemberId
    }

    if (filterValue.startsWith('profile:')) {
      const targetProfileId = filterValue.replace('profile:', '')
      return item.ho_so_benh_nhan_id === targetProfileId
    }

    if (filterValue.startsWith('name:')) {
      const targetName = filterValue.replace('name:', '').trim().toLowerCase()
      return (item.ten_khach || '').trim().toLowerCase() === targetName
    }

    return true
  }

  useEffect(() => {
    setResultsCurrentPage(1)
  }, [resultsStartDate, resultsEndDate, resultsPatientFilter])

  // Family group states
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null)
  const [familyLoading, setFamilyLoading] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')

  const otherPatientNames = useMemo(() => {
    const names = new Set<string>()
    const selfName = user?.ho_ten?.trim().toLowerCase() || ''
    const memberNames = new Set(familyGroup?.members?.map((m) => m.ho_ten.trim().toLowerCase()) || [])

    appointments.forEach((app) => {
      if (app.ten_khach && !app.member_id) {
        const lower = app.ten_khach.trim().toLowerCase()
        if (lower !== selfName && !memberNames.has(lower)) {
          names.add(app.ten_khach.trim())
        }
      }
    })
    medicalResults.forEach((res) => {
      if (res.ten_khach && !res.member_id) {
        const lower = res.ten_khach.trim().toLowerCase()
        if (lower !== selfName && !memberNames.has(lower)) {
          names.add(res.ten_khach.trim())
        }
      }
    })
    return Array.from(names)
  }, [appointments, medicalResults, user, familyGroup])

  // Appointment detail modal states
  const [selectedAppointment, setSelectedAppointment] = useState<PatientRecordDetail | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [contactEditOpen, setContactEditOpen] = useState(false)
  const [contactEditName, setContactEditName] = useState('')
  const [contactEditPhone, setContactEditPhone] = useState('')
  const [contactSaving, setContactSaving] = useState(false)

  // Member modal states
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberFormName, setMemberFormName] = useState('')
  const [memberFormDob, setMemberFormDob] = useState('')
  const [memberFormGender, setMemberFormGender] = useState<'nam' | 'nu' | 'khac'>('nam')
  const [memberFormRelation, setMemberFormRelation] = useState<string>('con')
  const [memberFormPhone, setMemberFormPhone] = useState('')
  const [memberFormBlood, setMemberFormBlood] = useState('')
  const [memberFormAllergy, setMemberFormAllergy] = useState('')
  const [memberFormBackground, setMemberFormBackground] = useState('')
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)

  const [hoTen, setHoTen] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [email, setEmail] = useState('')
  const [ngaySinh, setNgaySinh] = useState('')
  const [gioiTinh, setGioiTinh] = useState<'' | 'nam' | 'nu' | 'khac'>('')
  const [nhomMau, setNhomMau] = useState<'' | 'A' | 'B' | 'AB' | 'O'>('')
  const [diUng, setDiUng] = useState('')
  const [benhNen, setBenhNen] = useState('')
  const [diaChi, setDiaChi] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const latestAllowedBirthDateInput = getLatestAllowedBirthDateInput()

  const [toast, setToast] = useState<string | null>(null)
  const [cancelModalId, setCancelModalId] = useState<string | null>(null)
  // Giữ ID lịch hẹn thay vì boolean: modal cần biết dời lịch NÀO (trước đây chỉ mở một
  // hộp thoại tĩnh bảo khách gọi hotline, không gắn với lịch cụ thể).
  const [rescheduleAppId, setRescheduleAppId] = useState<string | null>(null)
  const [refundHelpAppId, setRefundHelpAppId] = useState<string | null>(null)

  // Ticker thời gian thực đếm ngược 15 phút cho lịch hẹn pending
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [serverTimeOffset, setServerTimeOffset] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  function getPaymentDeadlineCountdown(deadline?: string | null, currentMs: number = Date.now(), offsetMs: number = 0) {
    if (!deadline) return null
    const currentServerMs = currentMs + offsetMs
    const distance = new Date(deadline).getTime() - currentServerMs
    if (distance <= 0) return null
    const totalSeconds = Math.floor(distance / 1000)
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const secs = String(totalSeconds % 60).padStart(2, '0')
    return `${mins}:${secs}`
  }

  // Modal Thanh toán lại VNPAY
  const [payModalApp, setPayModalApp] = useState<PatientRecordListItem | null>(null)
  const [paySnapshot, setPaySnapshot] = useState<PatientPaymentStatusResult | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payQrUrl, setPayQrUrl] = useState('')

  async function handleOpenPayModal(app: PatientRecordListItem) {
    setPayModalApp(app)
    setPaySnapshot(null)
    setPayQrUrl('')
    setPayLoading(true)
    try {
      const data = await patientBookingService.createVnpaySession(app.id)
      setPaySnapshot(data)
      if (data?.server_time) {
        setServerTimeOffset(new Date(data.server_time).getTime() - Date.now())
      }
      if (data?.gateway?.expires_at) {
        setAppointments((prev) =>
          prev.map((item) => (item.id === app.id ? { ...item, payment_deadline: data.gateway.expires_at } : item))
        )
      }
    } catch (err: any) {
      setToast(err.response?.data?.message || err.message || 'Lịch hẹn đã quá hạn 15 phút và bị hủy.')
      setPayModalApp(null)
      loadAppointments()
    } finally {
      setPayLoading(false)
    }
  }

  useEffect(() => {
    if (!paySnapshot?.gateway?.qr_payload) {
      setPayQrUrl('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(paySnapshot.gateway.qr_payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setPayQrUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPayQrUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [paySnapshot?.gateway?.qr_payload])

  useEffect(() => {
    if (!payModalApp || paySnapshot?.payment_status === 'paid') return

    const intervalId = window.setInterval(async () => {
      try {
        const snapshot = await patientBookingService.getPaymentStatus(payModalApp.id)
        setPaySnapshot(snapshot)
        if (snapshot.payment_status === 'paid' && snapshot.appointment_status === 'confirmed') {
          setToast('Thanh toán VNPAY thành công!')
          setPayModalApp(null)
          loadAppointments()
        }
      } catch (_) {}
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [payModalApp, paySnapshot?.payment_status])

  const ownerMemberId = familyGroup?.members?.find((m) => m.la_chu_ho)?.id || null
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all')
  const [activeEndoscopyImage, setActiveEndoscopyImage] = useState<{ url: string; mo_ta?: string | null } | null>(null)

  const statusCounts = useMemo(() => {
    const counts = {
      all: appointments.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const app of appointments) {
      if (app.status === 'pending') counts.pending++
      else if (app.status === 'confirmed') counts.confirmed++
      else if (app.status === 'completed') counts.completed++
      else if (app.status === 'cancelled') counts.cancelled++
    }
    return counts
  }, [appointments])

  const filteredAppointments = appointments.filter((app) => {
    if (appStatusFilter !== 'all' && app.status !== appStatusFilter) {
      return false
    }
    if (!matchPatientFilter(app, appPatientFilter, user?.ho_ten || '', ownerMemberId)) {
      return false
    }
    if (appSearchDoctor && app.bac_si?.ho_ten) {
      if (!app.bac_si.ho_ten.toLowerCase().includes(appSearchDoctor.toLowerCase())) {
        return false
      }
    }
    if (appStartDate && app.ngay_kham < appStartDate) {
      return false
    }
    if (appEndDate && app.ngay_kham > appEndDate) {
      return false
    }
    return true
  })

  const filteredMedicalResults = medicalResults.filter((result) => {
    return matchPatientFilter(result, resultsPatientFilter, user?.ho_ten || '', ownerMemberId)
  })

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE))
  const paginatedAppointments = filteredAppointments.slice((appCurrentPage - 1) * ITEMS_PER_PAGE, appCurrentPage * ITEMS_PER_PAGE)

  useEffect(() => {
    setAppCurrentPage(1)
  }, [appSearchDoctor, appStartDate, appEndDate, appPatientFilter, appStatusFilter])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/profile')
    }
  }, [user, authLoading, navigate])

  // Tách riêng để dời lịch xong có thể nạp lại danh sách mà không phải reload trang.
  async function loadAppointments() {
    try {
      const result = await patientRecordsService.getAppointments()
      if (result?.server_time) {
        setServerTimeOffset(new Date(result.server_time).getTime() - Date.now())
      }
      setAppointments(Array.isArray(result?.data) ? result.data : [])
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được lịch hẹn của bạn.')
    }
  }

  useEffect(() => {
    if (!user) return

    setHoTen(user.ho_ten)
    setSoDienThoai(user.so_dien_thoai || '')
    setEmail(user.email)
    setNgaySinh(user.ngay_sinh ? new Date(user.ngay_sinh).toISOString().slice(0, 10) : '')
    setGioiTinh(user.gioi_tinh || '')
    setNhomMau(user.nhom_mau || '')
    setDiUng(user.di_ung || '')
    setBenhNen(user.benh_nen || '')
    setDiaChi(user.dia_chi || '')
    setGhiChu(user.ghi_chu || '')

    let profileIgnore = false
    authService.getProfile().then((profile) => {
      if (profileIgnore) return
      setHoTen(profile.ho_ten)
      setSoDienThoai(profile.so_dien_thoai || '')
      setEmail(profile.email)
      setNgaySinh(profile.ngay_sinh ? new Date(profile.ngay_sinh).toISOString().slice(0, 10) : '')
      setGioiTinh(profile.gioi_tinh || '')
      setNhomMau(profile.nhom_mau || '')
      setDiUng(profile.di_ung || '')
      setBenhNen(profile.benh_nen || '')
      setDiaChi(profile.dia_chi || '')
      setGhiChu(profile.ghi_chu || '')
    }).catch(() => {})

    let ignore = false
    setAppointmentsLoading(true)
    patientRecordsService.getAppointments()
      .then((result) => {
        if (!ignore) {
          setAppointments(Array.isArray(result?.data) ? result.data : [])
        }
      })
      .catch((error: any) => {
        if (!ignore) {
          setToast(error.response?.data?.message || error.message || 'Không tải được lịch hẹn của bạn.')
          setAppointments([])
        }
      })
      .finally(() => {
        if (!ignore) setAppointmentsLoading(false)
      })

    return () => {
      ignore = true
      profileIgnore = true
    }
  }, [user, justBooked])

  const fetchFamilyGroup = () => {
    if (!user) return
    setFamilyLoading(true)
    patientBookingService.getFamilyGroup()
      .then((group) => {
        setFamilyGroup(group)
      })
      .catch((error: any) => {
        setToast(error.response?.data?.message || error.message || 'Không tải được nhóm gia đình.')
      })
      .finally(() => {
        setFamilyLoading(false)
      })
  }

  const fetchReviews = (page = 1) => {
    setReviewsLoading(true)
    Promise.all([
      patientReviewService.getPending(),
      patientReviewService.getMy(page, 5),
    ])
      .then(([pending, myData]) => {
        setPendingReviews(pending)
        setMyReviews(myData.reviews)
        setReviewPage(myData.page)
        setReviewTotalPages(myData.totalPages)
      })
      .catch((error: any) => {
        console.error('Không tải được đánh giá:', error)
      })
      .finally(() => {
        setReviewsLoading(false)
      })
  }

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews(reviewPage)
    }
  }, [activeTab, reviewPage])

  useEffect(() => {
    fetchFamilyGroup()
  }, [user])

  useEffect(() => {
    if (activeTab === 'results' && user) {
      setMedicalResultsLoading(true)
      patientRecordsService.getMedicalResults({ 
        page: resultsCurrentPage, 
        limit: 5,
        startDate: resultsStartDate || undefined,
        endDate: resultsEndDate || undefined 
      })
        .then((res) => {
          setMedicalResults(res.data)
          setResultsTotalPages(Math.max(1, Math.ceil(res.total / res.limit)))
        })
        .catch((err: any) => {
          setToast(err.response?.data?.message || err.message || 'Không tải được kết quả khám.')
        })
        .finally(() => setMedicalResultsLoading(false))
    }
  }, [activeTab, resultsCurrentPage, user, resultsStartDate, resultsEndDate])

  useEffect(() => {
    const bookedId = searchParams.get('id')
    const paymentId = searchParams.get('payment_id')
    const isPaymentSuccess = searchParams.get('payment_status') === 'success'

    if (isPaymentSuccess && paymentId) {
      patientBookingService.confirmPayment(paymentId)
        .then(() => {
          patientRecordsService.getAppointments().then((res) => {
            setAppointments(Array.isArray(res?.data) ? res.data : [])
          })
        })
        .catch(() => {})
    }

    const targetId = bookedId || paymentId
    if (targetId && (justBooked || isPaymentSuccess || paymentId)) {
      setDetailLoading(true)
      patientRecordsService.getAppointmentDetail(targetId)
        .then((detail) => {
          if (justBooked) {
            if (detail.gia_kham === 0) {
              setToast('🎉 Đặt lịch tái khám thành công! Chi phí đã được miễn phí 100% theo chỉ định của bác sĩ.')
            } else {
              setToast('🎉 Đặt lịch thành công!')
            }
          }
          setSelectedAppointment(detail)
          setContactEditName(detail.ten_khach || '')
          setContactEditPhone(detail.so_dien_thoai_khach || '')
          setContactEditOpen(false)
          setDetailModalOpen(true)
        })
        .catch((error) => {
          console.error('Không tải được chi tiết lịch hẹn vừa đặt:', error)
          if (justBooked) {
            setToast('🎉 Đặt lịch thành công!')
          }
        })
        .finally(() => {
          setDetailLoading(false)
          // Xóa query params trên URL (?booked=true&id=...) để khi người dùng F5 không bị lặp lại popup & toast
          navigate('/profile', { replace: true })
        })
    }
  }, [searchParams, justBooked, navigate])

  function isAppointmentInPast(ngayKham: string, gioKham: string) {
    try {
      const appDate = new Date(ngayKham)
      if (gioKham && gioKham.includes(':')) {
        const [h, m] = gioKham.split(':').map(Number)
        appDate.setHours(h, m, 0, 0)
      } else {
        appDate.setHours(23, 59, 59, 999)
      }
      return appDate.getTime() < Date.now()
    } catch {
      return false
    }
  }

  function handleCancelClick(id: string) {
    setCancelModalId(id)
  }

  async function confirmCancel() {
    if (!cancelModalId) return
    try {
      const updated = await patientRecordsService.cancelAppointment(cancelModalId)
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === cancelModalId
            ? {
                ...item,
                status: updated.status as PatientRecordListItem['status'],
                payment_status: updated.payment_status as PatientRecordListItem['payment_status'],
              }
            : item
        )
      )
      setToast('Đã hủy lịch hẹn thành công.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Hủy lịch hẹn thất bại.')
    } finally {
      setCancelModalId(null)
    }
  }

  async function handleOpenAppointmentDetail(id: string) {
    setDetailLoading(true)
    try {
      const detail = await patientRecordsService.getAppointmentDetail(id)
      setSelectedAppointment(detail)
      setContactEditName(detail.ten_khach || '')
      setContactEditPhone(detail.so_dien_thoai_khach || '')
      setContactEditOpen(false)
      setDetailModalOpen(true)
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tải được chi tiết cuộc hẹn.')
    } finally {
      setDetailLoading(false)
    }
  }

  function canEditAppointmentContact(appointment: PatientRecordDetail) {
    return ['pending', 'confirmed'].includes(appointment.status)
      && !isAppointmentInPast(appointment.ngay_kham, appointment.gio_kham)
  }

  async function handleUpdateAppointmentContact(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedAppointment) return

    const normalizedName = normalizePersonName(contactEditName)
    const nameError = validatePatientName(normalizedName)
    if (nameError) {
      setToast(nameError)
      return
    }

    const phoneError = validateVietnamesePhone(contactEditPhone)
    if (phoneError) {
      setToast(phoneError)
      return
    }

    setContactSaving(true)
    try {
      const updated = await patientRecordsService.updateAppointmentContact(selectedAppointment.id, {
        ho_ten: normalizedName,
        so_dien_thoai: normalizePhoneInput(contactEditPhone),
      })

      setSelectedAppointment((current) => current ? {
        ...current,
        ten_khach: updated.ten_khach,
        so_dien_thoai_khach: updated.so_dien_thoai_khach,
      } : current)
      setAppointments((current) => current.map((appointment) => appointment.id === selectedAppointment.id ? {
        ...appointment,
        ten_khach: updated.ten_khach,
        so_dien_thoai_khach: updated.so_dien_thoai_khach,
      } : appointment))
      setContactEditOpen(false)
      setToast('Đã cập nhật thông tin cho lịch hẹn này.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể cập nhật thông tin lịch hẹn.')
    } finally {
      setContactSaving(false)
    }
  }

  async function handleDeleteAppointment(appointmentId: string) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch hẹn đã hủy này khỏi danh sách của bạn?')) {
      return
    }
    try {
      await patientRecordsService.deleteAppointment(appointmentId)
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId))
      setToast('🎉 Đã xóa lịch hẹn đã hủy khỏi danh sách.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể xóa lịch hẹn.')
    }
  }

  async function handleDeleteBatchCancelled() {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa TẤT CẢ ${statusCounts.cancelled} lịch hẹn đã hủy khỏi danh sách của bạn?`)) {
      return
    }
    try {
      const res = await patientRecordsService.deleteBatchCancelledAppointments()
      await loadAppointments()
      setToast(`🎉 ${res.deletedCount ? `Đã xóa ${res.deletedCount} lịch hẹn đã hủy khỏi danh sách.` : 'Đã dọn dẹp các lịch hẹn đã hủy.'}`)
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể xóa các lịch hẹn đã hủy.')
    }
  }

  async function handleUpdateProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return

    const normalizedName = normalizePersonName(hoTen)
    const nameError = validatePatientName(normalizedName)
    if (nameError) {
      setToast(nameError)
      return
    }

    const birthDateError = validateBirthDate(ngaySinh)
    if (birthDateError) {
      setToast(birthDateError)
      return
    }

    let phonePayload = normalizePhoneInput(soDienThoai)
    if (phonePayload) {
      const phoneError = validateVietnamesePhone(phonePayload)
      if (phoneError) {
        setToast(phoneError)
        return
      }
    }

    if (phonePayload) {
      const digits = phonePayload.replace(/\D/g, '')
      const cleanPhone = digits.startsWith('84') ? '0' + digits.slice(2) : digits
      // Chỉ bắt lỗi định dạng nếu người dùng thực sự nhập/thay đổi SĐT khác với SĐT hiện tại của tài khoản
      if (phonePayload !== user.so_dien_thoai && cleanPhone && !/^0\d{9,10}$/.test(cleanPhone)) {
        setToast('Số điện thoại không hợp lệ (phải bắt đầu bằng số 0 và có 10 chữ số).')
        return
      }
    }

    setProfileLoading(true)
    try {
      const updatedUser = await authService.updateProfile({
        ho_ten: normalizedName,
        so_dien_thoai: phonePayload,
        ngay_sinh: ngaySinh || null,
        gioi_tinh: gioiTinh || null,
        nhom_mau: nhomMau || null,
        di_ung: diUng.trim() || null,
        benh_nen: benhNen.trim() || null,
        dia_chi: diaChi.trim() || null,
        ghi_chu: ghiChu.trim() || null,
      })
      // Giữ nguyên toàn bộ thông tin phiên hiện tại, đặc biệt là id tài khoản.
      // Tên chỉ là thuộc tính hiển thị, không được thay thế khóa định danh.
      updateUser({
        ...user,
        ho_ten: updatedUser.ho_ten,
        so_dien_thoai: updatedUser.so_dien_thoai,
        anh_dai_dien: updatedUser.anh_dai_dien ?? user.anh_dai_dien ?? null,
        ngay_sinh: updatedUser.ngay_sinh,
        gioi_tinh: updatedUser.gioi_tinh,
        nhom_mau: updatedUser.nhom_mau,
        di_ung: updatedUser.di_ung,
        benh_nen: updatedUser.benh_nen,
        dia_chi: updatedUser.dia_chi,
        ghi_chu: updatedUser.ghi_chu,
      })
      setToast('Cập nhật thông tin cá nhân thành công.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể lưu thông tin cá nhân.')
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleCreateFamily(event: React.FormEvent) {
    event.preventDefault()
    if (!newFamilyName.trim()) return

    const ownerName = normalizePersonName(user?.ho_ten || 'Chủ hộ')
    const ownerNameError = validatePatientName(ownerName)
    if (ownerNameError) {
      setToast(ownerNameError)
      return
    }

    setFamilyLoading(true)
    try {
      await patientBookingService.createFamily({
        ten_nhom: newFamilyName.trim(),
        ho_ten: ownerName,
      })
      setNewFamilyName('')
      setToast('Tạo nhóm gia đình thành công.')
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Tạo nhóm thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  async function handleAddOrUpdateMember(event: React.FormEvent) {
    event.preventDefault()
    if (!memberFormName.trim() || !memberFormDob || !memberFormGender) {
      setToast('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }

    const normalizedName = normalizePersonName(memberFormName)
    const nameError = validatePatientName(normalizedName)
    if (nameError) {
      setToast(nameError)
      return
    }

    const birthDateError = validateBirthDate(memberFormDob)
    if (birthDateError) {
      setToast(birthDateError)
      return
    }

    setFamilyLoading(true)
    const payload = {
      ho_ten: normalizedName,
      ngay_sinh: memberFormDob,
      gioi_tinh: memberFormGender,
      quan_he: memberFormRelation || 'con',
      so_dien_thoai: memberFormPhone?.trim() ? normalizePhoneInput(memberFormPhone) : null,
      nhom_mau: memberFormBlood || null,
      di_ung: memberFormAllergy || null,
      benh_nen: memberFormBackground || null,
    }

    try {
      if (editingMemberId) {
        await patientBookingService.updateFamilyMember(editingMemberId, payload)
        setToast('Cập nhật thành viên gia đình thành công.')
      } else {
        await patientBookingService.addFamilyMember(payload)
        setToast('Thêm thành viên gia đình mới thành công.')
      }
      setMemberModalOpen(false)
      clearMemberForm()
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Thao tác thành viên thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  function handleEditMemberClick(member: FamilyMember) {
    setEditingMemberId(member.id)
    setMemberFormName(member.ho_ten)
    setMemberFormDob(new Date(member.ngay_sinh).toISOString().split('T')[0])
    setMemberFormGender(member.gioi_tinh)
    setMemberFormRelation(member.quan_he || 'con')
    setMemberFormPhone(member.so_dien_thoai || '')
    setMemberFormBlood(member.nhom_mau || '')
    setMemberFormAllergy(member.di_ung || '')
    setMemberFormBackground(member.benh_nen || '')
    setMemberModalOpen(true)
  }

  async function handleRemoveMember(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên gia đình này?')) return

    setFamilyLoading(true)
    try {
      await patientBookingService.removeFamilyMember(id)
      setToast('Đã xóa thành viên khỏi nhóm gia đình.')
      fetchFamilyGroup()
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Xóa thành viên thất bại.')
    } finally {
      setFamilyLoading(false)
    }
  }

  function clearMemberForm() {
    setEditingMemberId(null)
    setMemberFormName('')
    setMemberFormDob('')
    setMemberFormGender('nam')
    setMemberFormRelation('con')
    setMemberFormPhone('')
    setMemberFormBlood('')
    setMemberFormAllergy('')
    setMemberFormBackground('')
  }

  function getStatusBadge(status: PatientRecordListItem['status']) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    if (status === 'in_progress') return 'bg-purple-50 text-purple-700 border border-purple-100'
    if (status === 'waiting_record' || status === 'waiting_doctor_confirm') return 'bg-indigo-50 text-indigo-700 border border-indigo-100'
    if (status === 'checked_in') return 'bg-teal-50 text-teal-700 border border-teal-100'
    if (status === 'confirmed') return 'bg-blue-50 text-blue-700 border border-blue-100'
    if (status === 'cancelled') return 'bg-red-50 text-red-700 border border-red-100'
    if (status === 'no_show') return 'bg-slate-100 text-slate-600 border border-slate-200'
    if (status === 'skipped') return 'bg-orange-50 text-orange-700 border border-orange-100'
    return 'bg-amber-50 text-amber-700 border border-amber-100'
  }

  function getStatusLabel(status: PatientRecordListItem['status']) {
    if (status === 'completed') return 'Hoàn thành'
    if (status === 'in_progress') return 'Đang khám'
    if (status === 'waiting_record') return 'Chờ hoàn tất hồ sơ'
    if (status === 'waiting_doctor_confirm') return 'Chờ bác sĩ duyệt'
    if (status === 'checked_in') return 'Đã tiếp nhận'
    if (status === 'confirmed') return 'Đã xác nhận'
    if (status === 'cancelled') return 'Đã hủy'
    if (status === 'no_show') return 'Vắng mặt'
    if (status === 'skipped') return 'Qua lượt'
    return 'Chờ xác nhận'
  }

  function getPaymentLabel(status: PatientRecordListItem['payment_status']) {
    if (status === 'paid') return 'Đã thanh toán'
    if (status === 'refunded') return 'Đã hoàn tiền'
    if (status === 'partial') return 'Thanh toán một phần'
    return 'Chưa thanh toán'
  }

  if (authLoading || !user) {
    return null
  }

  return (
    <RouteTransition>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6">
      <Breadcrumb items={[{ label: 'Hồ sơ cá nhân' }]} />

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_-35px_rgba(15,118,110,0.5)]">
        <div className="flex flex-col gap-5 bg-[linear-gradient(120deg,#f0fdfa_0%,#ffffff_58%,#f8fafc_100%)] px-5 py-6 sm:flex-row sm:items-center sm:px-8">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-sm">
            {user.ho_ten?.split(' ').pop()?.charAt(0) || 'B'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Khu vực bệnh nhân</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Hồ sơ cá nhân</h1>
            <p className="mt-1 text-sm text-slate-600">Quản lý lịch hẹn, thông tin liên hệ và kết quả khám của gia đình.</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs text-slate-500">Đang đăng nhập với</p>
            <p className="mt-0.5 max-w-[240px] truncate font-semibold text-slate-800">{user.email}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm lg:w-72">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tài khoản</p>
            <p className="mt-1 text-base font-bold text-slate-900">{user.ho_ten}</p>
            <p className="mt-1 text-xs text-slate-500">Thông tin được cập nhật trực tiếp vào hồ sơ.</p>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            {[
              { key: 'appointments', label: 'Lịch hẹn', meta: 'Theo dõi lịch khám' },
              { key: 'results', label: 'Kết quả y tế', meta: 'Đơn thuốc & chẩn đoán' },
              { key: 'followups', label: 'Tái khám', meta: 'Cần đặt lịch lại' },
              { key: 'family', label: 'Sổ gia đình', meta: 'Hồ sơ người thân' },
              { key: 'account', label: 'Thông tin cá nhân', meta: 'Tên và số liên hệ' },
              { key: 'reviews', label: 'Đánh giá', meta: 'Lịch sử & chờ đánh giá' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === tab.key ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-0.5 block text-xs ${activeTab === tab.key ? 'text-teal-100' : 'text-slate-400'}`}>{tab.meta}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="w-full flex-1 text-left">
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Quản lý lịch hẹn</h3>
                <p className="text-xs text-slate-400">Theo dõi trạng thái lịch hẹn và tình trạng thanh toán từ dữ liệu thật của hệ thống.</p>
              </div>

              {/* Status Filter Tabs / Pills */}
              {appointments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: 'all', label: 'Tất cả', count: statusCounts.all },
                    { key: 'pending', label: 'Chờ xác nhận', count: statusCounts.pending },
                    { key: 'confirmed', label: 'Đã xác nhận', count: statusCounts.confirmed },
                    { key: 'completed', label: 'Hoàn thành', count: statusCounts.completed },
                    { key: 'cancelled', label: 'Đã hủy', count: statusCounts.cancelled },
                  ].map((st) => {
                    const isActive = appStatusFilter === st.key
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setAppStatusFilter(st.key as any)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition border ${
                          isActive
                            ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{st.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {st.count}
                        </span>
                      </button>
                    )
                  })}
                  {statusCounts.cancelled > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteBatchCancelled}
                      className="ml-auto px-3.5 py-1.5 rounded-full text-xs font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition flex items-center gap-1.5 shadow-sm"
                      title="Xóa toàn bộ các lịch hẹn đã hủy khỏi danh sách của bạn"
                    >
                      <span>🗑️ Xóa tất cả {statusCounts.cancelled} lịch đã hủy</span>
                    </button>
                  )}
                </div>
              )}

              {appointments.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-3">
                  <div className="w-full md:w-60">
                    <select
                      value={appPatientFilter}
                      onChange={(e) => setAppPatientFilter(e.target.value)}
                      className="input w-full text-sm font-medium"
                    >
                      <option value="all">👥 Tất cả người khám</option>
                      <option value="self">👤 Bản thân ({user?.ho_ten || 'Tôi'})</option>
                      {familyGroup?.members?.filter((m) => !m.la_chu_ho).map((m) => (
                        <option key={m.id} value={`member:${m.id}`}>
                          {getQuanHeEmoji(m.quan_he)} {m.ho_ten} ({formatQuanHeLabel(m.quan_he || 'con')})
                        </option>
                      ))}
                      {otherPatientNames.map((name) => (
                        <option key={name} value={`name:${name}`}>
                          👤 {name} (Đặt hộ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <Input
                      label=""
                      placeholder="Tìm theo tên bác sĩ..."
                      value={appSearchDoctor}
                      onChange={(e) => setAppSearchDoctor(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        label=""
                        type="date"
                        value={appStartDate}
                        onChange={(e) => setAppStartDate(e.target.value)}
                      />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="flex-1">
                      <Input
                        label=""
                        type="date"
                        value={appEndDate}
                        onChange={(e) => setAppEndDate(e.target.value)}
                      />
                    </div>
                    {(appSearchDoctor || appStartDate || appEndDate || appPatientFilter !== 'all' || appStatusFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setAppSearchDoctor('')
                          setAppStartDate('')
                          setAppEndDate('')
                          setAppPatientFilter('all')
                          setAppStatusFilter('all')
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Xóa bộ lọc"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {appointmentsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải danh sách lịch hẹn...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Bạn chưa có lịch hẹn khám nào.
                  </div>
                ) : paginatedAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Không tìm thấy lịch hẹn phù hợp.
                  </div>
                ) : (
                  <>
                    {paginatedAppointments.map((appointment) => {
                      const deadlineCountdown = getPaymentDeadlineCountdown(appointment.payment_deadline, nowMs, serverTimeOffset)
                      const canPayNow = appointment.status === 'pending' && appointment.payment_status === 'unpaid' && Boolean(deadlineCountdown)
                      const isExpiredPending = appointment.status === 'pending' && appointment.payment_status === 'unpaid' && !deadlineCountdown
                      const isCancelledOrNoShow = ['cancelled', 'no_show', 'skipped'].includes(appointment.status)
                      const isPast = isAppointmentInPast(appointment.ngay_kham, appointment.gio_kham)
                      const isNormalValidAppointment = ['pending', 'confirmed'].includes(appointment.status) && !isExpiredPending && !isPast

                      return (
                        <div
                          key={appointment.id}
                          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-brand-100 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                  Mã: {appointment.id.slice(-6).toUpperCase()}
                                </span>

                                {isExpiredPending ? (
                                  <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold">
                                    ⚠️ Quá hạn 15 phút - Đã tự động hủy
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadge(appointment.status)}`}>
                                    {getStatusLabel(appointment.status)}
                                  </span>
                                )}

                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                  {getPaymentLabel(appointment.payment_status)}
                                </span>

                                {canPayNow && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
                                    ⏱️ Giữ chỗ còn {deadlineCountdown}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-base font-bold text-slate-800">
                                {appointment.ten_dich_vu || 'Khám lâm sàng Tai Mũi Họng'}
                              </h4>
                              <p className="text-xs text-slate-600 font-medium">
                                👤 Bệnh nhân: <span className="font-bold text-slate-800">{appointment.ten_khach || user?.ho_ten}</span>{' '}
                                {appointment.member_id ? (
                                  <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ml-1">
                                    Thành viên gia đình
                                  </span>
                                ) : appointment.ten_khach && appointment.ten_khach !== user?.ho_ten ? (
                                  <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ml-1">
                                    Đặt hộ người thân
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ml-1">
                                    Bản thân
                                  </span>
                                )}
                                {appointment.so_dien_thoai_khach && (
                                  <span className="text-slate-500 font-normal ml-2">
                                    • SĐT: <strong className="text-slate-700">{appointment.so_dien_thoai_khach}</strong>
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                Bác sĩ phụ trách: <span className="font-semibold text-slate-700">{appointment.bac_si.ho_ten}</span>
                              </p>
                              <p className="text-xs text-slate-400">
                                Thời gian: <span className="font-semibold text-brand-600">{appointment.gio_kham}</span>, ngày {new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')}
                              </p>
                            </div>

                            <div className="flex flex-col items-start md:items-end gap-3 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                              <div className="text-left md:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phí thanh toán</p>
                                <p className="text-base font-extrabold text-slate-900">{appointment.gia_kham.toLocaleString('vi-VN')} đ</p>
                              </div>

                              <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAppointmentDetail(appointment.id)}
                                  disabled={detailLoading}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
                                >
                                  {detailLoading ? 'Đang tải...' : appointment.status === 'completed' ? 'Xem kết quả' : 'Chi tiết'}
                                </button>

                                {canPayNow && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(appointment)}
                                    className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Thanh toán VNPAY ngay để giữ chỗ lượt khám này"
                                  >
                                    <span>💳 Thanh toán ngay</span>
                                    <span className="bg-teal-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight">{deadlineCountdown}</span>
                                  </button>
                                )}

                                {isNormalValidAppointment && (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => setRescheduleAppId(appointment.id)}
                                      className="border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                    >
                                      Dời lịch
                                    </Button>
                                    {appointment.payment_status === 'paid' ? (
                                      <Button
                                        variant="secondary"
                                        onClick={() => setRefundHelpAppId(appointment.id)}
                                        className="border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                      >
                                        Hủy lịch
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="secondary"
                                        onClick={() => handleCancelClick(appointment.id)}
                                        className="border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                      >
                                        Hủy lịch
                                      </Button>
                                    )}
                                  </>
                                )}

                                {(isExpiredPending || isCancelledOrNoShow) && (
                                  <>
                                    <Link
                                      to="/booking"
                                      className="px-3.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50 text-xs font-bold text-teal-700 hover:bg-teal-100 transition inline-flex items-center gap-1 shadow-2xs"
                                    >
                                      🔄 Đặt lịch mới
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAppointment(appointment.id)}
                                      className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50/50 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition flex items-center gap-1"
                                      title="Xóa lịch hẹn này khỏi danh sách của bạn"
                                    >
                                      <span className="text-xs">🗑️</span> Xóa
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {totalPages > 0 && (
                    <div className="pt-2">
                      <Pagination
                        currentPage={appCurrentPage}
                        totalPages={totalPages}
                        onPageChange={setAppCurrentPage}
                      />
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Kết quả y tế & Đơn thuốc</h3>
                <p className="text-xs text-slate-400">Xem lại các chẩn đoán bệnh, hướng dẫn điều trị và đơn thuốc từ bác sĩ.</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div className="w-full md:w-60">
                  <select
                    value={resultsPatientFilter}
                    onChange={(e) => setResultsPatientFilter(e.target.value)}
                    className="input w-full text-sm font-medium"
                  >
                    <option value="all">👥 Tất cả người khám</option>
                    <option value="self">👤 Bản thân ({user?.ho_ten || 'Tôi'})</option>
                    {familyGroup?.members?.filter((m) => !m.la_chu_ho).map((m) => (
                      <option key={m.id} value={`member:${m.id}`}>
                        {getQuanHeEmoji(m.quan_he)} {m.ho_ten} ({formatQuanHeLabel(m.quan_he || 'con')})
                      </option>
                    ))}
                    {otherPatientNames.map((name) => (
                      <option key={name} value={`name:${name}`}>
                        👤 {name} (Đặt hộ)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-semibold text-slate-600 whitespace-nowrap hidden sm:inline">Từ ngày:</span>
                  <div className="flex-1">
                    <Input
                      label=""
                      type="date"
                      value={resultsStartDate}
                      onChange={(e) => setResultsStartDate(e.target.value)}
                    />
                  </div>
                  <span className="text-slate-400">-</span>
                  <div className="flex-1">
                    <Input
                      label=""
                      type="date"
                      value={resultsEndDate}
                      onChange={(e) => setResultsEndDate(e.target.value)}
                    />
                  </div>
                  {(resultsStartDate || resultsEndDate || resultsPatientFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setResultsStartDate('')
                        setResultsEndDate('')
                        setResultsPatientFilter('all')
                      }}
                      className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Xóa bộ lọc"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {medicalResultsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải danh sách kết quả...
                  </div>
                ) : medicalResults.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Bạn chưa có kết quả khám nào được ghi nhận.
                  </div>
                ) : filteredMedicalResults.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Không tìm thấy kết quả khám phù hợp với người bệnh đã chọn.
                  </div>
                ) : (
                  <>
                    {filteredMedicalResults.map((result) => {
                      const isExpanded = expandedResultIds.has(result.id)
                      return (
                        <div
                          key={result.id}
                          className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-brand-100"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div>
                              <h4 className="text-base font-bold text-slate-800">
                                {result.ten_dich_vu || 'Khám lâm sàng'}
                              </h4>
                              <p className="text-xs text-slate-600 font-medium mt-1">
                                👤 Bệnh nhân: <span className="font-bold text-slate-800">{result.ten_khach || user?.ho_ten}</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Bác sĩ: <span className="font-semibold text-slate-700">{result.bac_si.ho_ten}</span>
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-3 sm:text-right">
                              <p className="text-xs font-semibold text-brand-600 bg-brand-50 inline-block px-2.5 py-1 rounded-lg">
                                {result.gio_kham}, {new Date(result.ngay_kham).toLocaleDateString('vi-VN')}
                              </p>
                              <button
                                onClick={() => {
                                  setExpandedResultIds(prev => {
                                    const next = new Set(prev)
                                    if (next.has(result.id)) next.delete(result.id)
                                    else next.add(result.id)
                                    return next
                                  })
                                }}
                                className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 transition"
                              >
                                {isExpanded ? 'Thu gọn kết quả' : 'Xem chi tiết kết quả'}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 space-y-4 border-t border-slate-50 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              {/* Body of card: Diagnosis and Guide */}
                              <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chẩn đoán</p>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {result.ket_qua.chan_doan || 'Chưa có chẩn đoán chi tiết.'}
                                  </p>
                                </div>
                                {result.ket_qua.huong_dan_dieu_tri && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hướng dẫn điều trị</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                      {result.ket_qua.huong_dan_dieu_tri}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Vitals */}
                              {hasVitalsData(result.ket_qua.sinh_hieu) && (
                                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                                    <span>❤️</span> Sinh hiệu
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {result.ket_qua.sinh_hieu.nhip_tim != null && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Nhịp tim</p>
                                        <p className="text-sm font-bold text-slate-800">{result.ket_qua.sinh_hieu.nhip_tim} <span className="text-xs font-medium text-slate-500">bpm</span></p>
                                      </div>
                                    )}
                                    {result.ket_qua.sinh_hieu.huyet_ap != null && result.ket_qua.sinh_hieu.huyet_ap !== '' && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Huyết áp</p>
                                        <p className="text-sm font-bold text-slate-800">{result.ket_qua.sinh_hieu.huyet_ap} <span className="text-xs font-medium text-slate-500">mmHg</span></p>
                                      </div>
                                    )}
                                    {result.ket_qua.sinh_hieu.nhiet_do != null && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Nhiệt độ</p>
                                        <p className="text-sm font-bold text-slate-800">{result.ket_qua.sinh_hieu.nhiet_do} <span className="text-xs font-medium text-slate-500">°C</span></p>
                                      </div>
                                    )}
                                    {result.ket_qua.sinh_hieu.can_nang != null && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Cân nặng</p>
                                        <p className="text-sm font-bold text-slate-800">{result.ket_qua.sinh_hieu.can_nang} <span className="text-xs font-medium text-slate-500">kg</span></p>
                                      </div>
                                    )}
                                    {result.ket_qua.sinh_hieu.chieu_cao != null && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Chiều cao</p>
                                        <p className="text-sm font-bold text-slate-800">{result.ket_qua.sinh_hieu.chieu_cao} <span className="text-xs font-medium text-slate-500">cm</span></p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Endoscopic / Service Result Images */}
                              {result.ket_qua.hinh_anh_noi_soi && result.ket_qua.hinh_anh_noi_soi.length > 0 && (
                                <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                                      <span>📸</span> Hình ảnh nội soi / Kết quả dịch vụ
                                    </p>
                                    <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                                      {result.ket_qua.hinh_anh_noi_soi.length} ảnh
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    {result.ket_qua.hinh_anh_noi_soi.map((img, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setActiveEndoscopyImage(img)}
                                        className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-sky-500 hover:shadow-md text-left"
                                      >
                                        <img
                                          src={resolveMediaUrl(img.url) || ''}
                                          alt={img.mo_ta || `Ảnh nội soi ${idx + 1}`}
                                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />
                                        {img.mo_ta && (
                                          <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-1 backdrop-blur-[2px]">
                                            <p className="truncate text-[10px] font-medium text-white">{img.mo_ta}</p>
                                          </div>
                                        )}
                                        <div className="absolute inset-0 bg-sky-900/20 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                                          <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-sky-700 shadow-sm">🔍 Phóng to</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Prescriptions */}
                              {result.ket_qua.thuoc && result.ket_qua.thuoc.length > 0 && (
                                <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">💊 Đơn thuốc</p>
                                  <ul className="space-y-2">
                                    {result.ket_qua.thuoc.map((thuoc, index) => (
                                      <li key={index} className="flex gap-3 items-start bg-white/80 rounded-lg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 shrink-0 mt-0.5">
                                          {index + 1}
                                        </span>
                                        <div className="flex-1 text-sm">
                                          {typeof thuoc === 'string' ? (
                                            <p className="font-semibold text-slate-800">{thuoc}</p>
                                          ) : (
                                            <>
                                              <p className="font-bold text-slate-800">{thuoc.ten_thuoc || 'Thuốc'}</p>
                                              <p className="text-xs text-slate-600 mt-1">
                                                {thuoc.lieu_luong && <span className="mr-3">Liều lượng: <strong>{thuoc.lieu_luong}</strong></span>}
                                                {thuoc.tan_suat && <span className="mr-3">Tần suất: <strong>{thuoc.tan_suat}</strong></span>}
                                                {thuoc.so_ngay && <span>Số ngày: <strong>{thuoc.so_ngay} ngày</strong></span>}
                                              </p>
                                              {thuoc.ghi_chu && (
                                                <p className="text-[11px] text-slate-500 italic mt-1">Ghi chú: {thuoc.ghi_chu}</p>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {resultsTotalPages > 0 && (
                      <div className="pt-2">
                        <Pagination
                          currentPage={resultsCurrentPage}
                          totalPages={resultsTotalPages}
                          onPageChange={setResultsCurrentPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Tái khám</h3>
                <p className="text-xs text-slate-400">Danh sách các hồ sơ được bác sĩ yêu cầu tái khám nhưng chưa đặt lịch.</p>
              </div>

              {followupsLoading ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                  Đang tải danh sách tái khám...
                </div>
              ) : followups.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
                  Bạn không có lịch tái khám nào cần đặt lịch.
                </div>
              ) : (
                <div className="space-y-4">
                  {followups.map((fu) => {
                    let isOverdue = false
                    let hanCuoiDate = null
                    if (fu.ngay_tai_kham) {
                      hanCuoiDate = new Date(fu.ngay_tai_kham)
                      hanCuoiDate.setDate(hanCuoiDate.getDate() + 14) // Trễ 2 tuần
                      isOverdue = hanCuoiDate.setHours(23,59,59,999) < Date.now()
                    }
                    
                    return (
                      <div
                        key={fu.lich_hen_goc_id}
                        className={`rounded-2xl border-2 p-5 shadow-sm transition-all ${
                          isOverdue ? 'border-red-300 bg-red-50/60 ring-2 ring-red-100' : 'border-blue-100 bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-lg">{fu.benh_nhan.ten_khach}</h4>
                              {isOverdue && (
                                <span className="rounded-lg bg-red-600 px-3 py-1 text-xs font-black uppercase text-white shadow-sm">
                                  ⚠️ Đã quá hạn tái khám miễn phí
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">
                              Khám ngày: <span className="font-semibold text-slate-800">{new Date(fu.ngay_kham_cu).toLocaleDateString('vi-VN')}</span>
                            </p>
                            <p className="text-sm text-slate-600">
                              Bác sĩ: <span className="font-semibold text-slate-800">{fu.bac_si?.ho_ten || 'Không rõ'}</span>
                            </p>
                            <p className="text-sm text-slate-600">
                              Chẩn đoán: <span className="font-semibold text-slate-800">{fu.chan_doan}</span>
                            </p>
                            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold ${
                              isOverdue
                                ? 'bg-red-200 text-red-950 border border-red-300'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {fu.ngay_tai_kham
                                ? (isOverdue
                                    ? `⛔ Hạn cuối: ${hanCuoiDate.toLocaleDateString('vi-VN')}`
                                    : `Hạn tái khám miễn phí: ${hanCuoiDate.toLocaleDateString('vi-VN')}`)
                                : 'Tái khám miễn phí không giới hạn thời gian'}
                            </div>
                          </div>
                          <Link
                            to={`/booking?followup_id=${fu.lich_hen_goc_id || fu.hang_doi_id}`}
                            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition shadow-sm ${
                              isOverdue
                                ? 'bg-slate-700 text-white hover:bg-slate-800'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {isOverdue ? 'Xem chi tiết' : 'Đặt lịch ngay'}
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'family' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">Sổ quản lý gia đình</h3>
                  <p className="text-xs text-slate-400">Lưu thông tin sức khỏe và đặt lịch khám nhanh cho thành viên trong nhà.</p>
                </div>
                {familyGroup && (
                  <Button
                    onClick={() => {
                      clearMemberForm()
                      setMemberModalOpen(true)
                    }}
                    className="text-xs py-2 px-3 bg-brand-500 hover:bg-brand-600 font-bold flex items-center gap-1.5 text-white"
                  >
                    Thêm thành viên mới
                  </Button>
                )}
              </div>

              {familyLoading && !familyGroup ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                  Đang tải thông tin nhóm gia đình...
                </div>
              ) : !familyGroup ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                  <div className="bg-brand-50/30 p-4 rounded-xl border border-brand-50 text-slate-700 text-sm">
                    <p className="font-bold text-brand-700 text-base mb-1">👨‍👩‍👧‍👦 Bạn chưa có nhóm gia đình</p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Tính năng quản lý gia đình cho phép bạn lưu thông tin người thân (con cái, bố mẹ, vợ/chồng) để theo dõi kết quả khám bệnh, đơn thuốc tập trung và **đặt lịch khám hộ nhanh** mà không cần nhập lại thông tin.
                    </p>
                  </div>
                  <form onSubmit={handleCreateFamily} className="space-y-4 max-w-md text-left">
                    <Input
                      label="Tên nhóm gia đình (ví dụ: Gia đình họ Nguyễn, Gia đình An & Bình)"
                      placeholder="Nhập tên nhóm gia đình..."
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      required
                    />
                    <Button type="submit" loading={familyLoading}>Tạo nhóm gia đình mới</Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Tên nhóm gia đình banner */}
                  <div className="bg-brand-600 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold">🏠 {familyGroup.ten_nhom}</h4>
                      <p className="text-xs text-brand-100 mt-1">Mã nhóm: {familyGroup.id.toUpperCase()}</p>
                    </div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      👪 {familyGroup.members.length} Thành viên
                    </span>
                  </div>

                  {/* Danh sách thành viên card grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {familyGroup.members.map((member) => {
                      const ageText = calculateAge(member.ngay_sinh)
                      const relationText = member.la_chu_ho ? 'Chủ tài khoản' : formatQuanHeLabel(member.quan_he || 'con')
                      const relationEmoji = member.la_chu_ho ? '👤' : getQuanHeEmoji(member.quan_he)
                      const phoneDisplay = member.so_dien_thoai || (member.la_chu_ho ? (soDienThoai || user?.so_dien_thoai || 'Chưa cập nhật') : (soDienThoai || user?.so_dien_thoai ? `${soDienThoai || user?.so_dien_thoai} (Theo Chủ hộ)` : 'Chưa cập nhật'))

                      return (
                        <div
                          key={member.id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 relative flex flex-col justify-between hover:border-brand-200 transition"
                        >
                          <div className="space-y-3">
                            {/* Header: Name + Relation Badge */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{relationEmoji}</span>
                                  <h4 className="font-bold text-slate-800 text-base">
                                    {member.ho_ten}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-500">
                                  {member.gioi_tinh === 'nam' ? 'Nam' : member.gioi_tinh === 'nu' ? 'Nữ' : 'Khác'}
                                  {member.ngay_sinh && ` • ${new Date(member.ngay_sinh).toLocaleDateString('vi-VN')}`}
                                  {ageText && ` (${ageText})`}
                                </p>
                              </div>
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${member.la_chu_ho ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                {relationText}
                              </span>
                            </div>

                            {/* Medical & Contact Details */}
                            <div className="rounded-xl bg-slate-50/70 p-3 text-xs space-y-2 border border-slate-100 font-medium">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">📱 SĐT liên hệ:</span>
                                <span className="font-bold text-slate-800">{phoneDisplay}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                <div>
                                  <span className="text-slate-500">🩸 Nhóm máu: </span>
                                  <span className="font-bold text-slate-800">{member.nhom_mau || 'Chưa rõ'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">⚠️ Dị ứng: </span>
                                  <span className={`font-bold ${member.di_ung ? 'text-amber-700' : 'text-slate-700'}`}>
                                    {member.di_ung || 'Không có'}
                                  </span>
                                </div>
                              </div>
                              <div className="pt-1 border-t border-slate-100">
                                <span className="text-slate-500">🏥 Bệnh nền: </span>
                                <span className="font-semibold text-slate-700">{member.benh_nen || 'Không ghi nhận'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: View Appts, View Results, Edit, Delete */}
                          <div className="space-y-2 border-t border-slate-100 pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAppPatientFilter(member.la_chu_ho ? 'self' : `member:${member.id}`)
                                  setActiveTab('appointments')
                                }}
                                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 px-2.5 py-2 rounded-lg border border-slate-200 transition text-center"
                              >
                                📅 Xem lịch hẹn
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResultsPatientFilter(member.la_chu_ho ? 'self' : `member:${member.id}`)
                                  setActiveTab('results')
                                }}
                                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 px-2.5 py-2 rounded-lg border border-slate-200 transition text-center"
                              >
                                💊 Xem kết quả
                              </button>
                            </div>

                            {!member.la_chu_ho && (
                              <div className="flex justify-end gap-2 pt-1 border-t border-slate-50">
                                <button
                                  type="button"
                                  onClick={() => handleEditMemberClick(member)}
                                  className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-200 transition"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded border border-red-200 transition"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Cập nhật hồ sơ bệnh nhân</h3>
                <p className="text-xs text-slate-400">Thông tin hành chính dùng để liên hệ đặt lịch khám.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Họ và tên bệnh nhân"
                    value={hoTen}
                    onChange={(event) => setHoTen(event.target.value)}
                    onBlur={() => setHoTen((current) => normalizePersonName(current))}
                    required
                  />
                  <Input
                    label="Số điện thoại liên hệ"
                    value={soDienThoai}
                    onChange={(event) => setSoDienThoai(normalizePhoneInput(event.target.value))}
                    placeholder="Nhập số điện thoại (không bắt buộc)"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Ngày sinh"
                    type="date"
                    value={ngaySinh}
                    onChange={(event) => setNgaySinh(event.target.value)}
                    max={latestAllowedBirthDateInput}
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Giới tính</label>
                    <select value={gioiTinh} onChange={(event) => setGioiTinh(event.target.value as typeof gioiTinh)} className="input w-full">
                      <option value="">Chưa cập nhật</option><option value="nam">Nam</option><option value="nu">Nữ</option><option value="khac">Khác</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Nhóm máu</label>
                    <select
                      value={nhomMau}
                      onChange={(event) => setNhomMau(event.target.value as typeof nhomMau)}
                      className="input w-full"
                    >
                      <option value="">Chưa cập nhật</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </div>
                  <Input label="Địa chỉ" value={diaChi} onChange={(event) => setDiaChi(event.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium text-slate-700">
                    Dị ứng
                    <textarea rows={3} value={diUng} onChange={(event) => setDiUng(event.target.value)} className="input w-full resize-y" placeholder="Ví dụ: dị ứng Penicillin, hải sản..." />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-slate-700">
                    Bệnh nền
                    <textarea rows={3} value={benhNen} onChange={(event) => setBenhNen(event.target.value)} className="input w-full resize-y" placeholder="Ví dụ: tăng huyết áp, tiểu đường..." />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                    Ghi chú
                    <textarea rows={3} value={ghiChu} onChange={(event) => setGhiChu(event.target.value)} className="input w-full resize-y" placeholder="Thông tin khác muốn lưu cho hồ sơ của bạn" />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Email đăng ký:</span> {email}
                  <p className="mt-1 text-xs text-slate-500">Email dùng để đăng nhập và không thể chỉnh sửa tại đây.</p>
                </div>

                <div className="flex justify-end border-t border-slate-50 pt-2">
                  <Button type="submit" loading={profileLoading}>Lưu thay đổi</Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              {/* Lịch hẹn chờ đánh giá */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Lịch hẹn chờ đánh giá</h3>
                    <p className="text-xs text-slate-400">
                      Đánh giá lượt khám đã hoàn thành để nâng cao chất lượng dịch vụ phòng khám.
                    </p>
                  </div>
                  {pendingReviews.length > 0 && (
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 border border-teal-100">
                      {pendingReviews.length} cuộc hẹn
                    </span>
                  )}
                </div>

                {reviewsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải danh sách chờ đánh giá...
                  </div>
                ) : pendingReviews.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Bạn không có lịch hẹn nào đang chờ đánh giá.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {pendingReviews.map((item) => (
                      <div
                        key={item.appointment_id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 hover:shadow-md transition"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                🩺 {item.doctor?.ho_ten || 'Bác sĩ'}
                              </h4>
                              {item.specialty && (
                                <p className="text-xs text-teal-700 font-medium">
                                  {item.specialty.ten}
                                </p>
                              )}
                            </div>
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600">
                              Hoàn thành
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-500 border-t border-slate-50 pt-2">
                            <p>
                              📅 Khám ngày:{' '}
                              <strong className="text-slate-700">
                                {new Date(item.ngay_kham).toLocaleDateString('vi-VN')}
                              </strong>
                            </p>
                            <p>
                              🕐 Giờ:{' '}
                              <strong className="text-slate-700">{item.gio_kham}</strong>
                            </p>
                            {item.phong_kham && (
                              <p>
                                🏠 Phòng:{' '}
                                <strong className="text-slate-700">{item.phong_kham}</strong>
                              </p>
                            )}
                            {item.ma_lich_hen && (
                              <span className="font-mono text-slate-400 font-normal">
                                Mã: {item.ma_lich_hen}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewApp(item)
                            setReviewModalOpen(true)
                          }}
                          className="w-full rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Star size={14} className="fill-amber-300 text-amber-300" />
                          Viết đánh giá
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Đánh giá đã gửi */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-1 border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-800">Đánh giá đã gửi</h3>
                  <p className="text-xs text-slate-400">
                    Lịch sử các đánh giá và nhận xét bạn đã gửi cho phòng khám.
                  </p>
                </div>

                {reviewsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Đang tải danh sách đánh giá...
                  </div>
                ) : myReviews.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">
                    Bạn chưa gửi đánh giá nào.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myReviews.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={
                                    s <= r.so_sao
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'fill-none text-slate-200'
                                  }
                                  size={16}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-700">({r.so_sao}/5 sao)</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(r.ngay_tao).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {/* 3 Chi tiết tiêu chí */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            🛎️ Lễ tân: <strong className="font-bold text-emerald-800">{r.chi_tiet?.danh_gia_le_tan ?? r.so_sao ?? 5}⭐</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
                            🩺 Bác sĩ: <strong className="font-bold text-teal-800">{r.chi_tiet?.danh_gia_bac_si ?? r.so_sao ?? 5}⭐</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            🏥 Dịch vụ: <strong className="font-bold text-blue-800">{r.chi_tiet?.danh_gia_dich_vu ?? r.so_sao ?? 5}⭐</strong>
                          </span>
                        </div>

                        {r.doctor && (
                          <div className="text-xs font-semibold text-slate-600">
                            🩺 {r.doctor.ho_ten}
                            {r.appointment?.specialty && (
                              <span className="text-slate-400 font-normal">
                                {' '}· {r.appointment.specialty.ten}
                              </span>
                            )}
                          </div>
                        )}

                        {r.noi_dung && (
                          <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">
                            &ldquo;{r.noi_dung}&rdquo;
                          </p>
                        )}

                        {r.appointment && (
                          <p className="text-[10px] text-slate-400 pt-1">
                            Lượt khám ngày:{' '}
                            {new Date(r.appointment.ngay_kham).toLocaleDateString('vi-VN')}
                            {r.appointment.ma_lich_hen ? ` · Mã: ${r.appointment.ma_lich_hen}` : ''}
                          </p>
                        )}
                      </div>
                    ))}

                    {reviewTotalPages > 1 && (
                      <div className="pt-2">
                        <Pagination
                          currentPage={reviewPage}
                          totalPages={reviewTotalPages}
                          onPageChange={setReviewPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {memberModalOpen && (
        <Modal
          isOpen={memberModalOpen}
          onClose={() => {
            setMemberModalOpen(false)
            clearMemberForm()
          }}
          title={editingMemberId ? 'SỬA THÀNH VIÊN GIA ĐÌNH' : 'THÊM THÀNH VIÊN GIA ĐÌNH'}
        >
          <form onSubmit={handleAddOrUpdateMember} className="space-y-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Họ và tên thành viên *"
                placeholder="Nhập họ và tên..."
                value={memberFormName}
                onChange={(e) => setMemberFormName(e.target.value)}
                onBlur={() => setMemberFormName((current) => normalizePersonName(current))}
                required
              />
              <Input
                label="Ngày sinh *"
                type="date"
                value={memberFormDob}
                onChange={(e) => setMemberFormDob(e.target.value)}
                max={latestAllowedBirthDateInput}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Mối quan hệ *</label>
                <select
                  value={memberFormRelation}
                  onChange={(e) => setMemberFormRelation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="con">Con</option>
                  <option value="cha">Bố / Cha</option>
                  <option value="me">Mẹ</option>
                  <option value="vo">Vợ</option>
                  <option value="chong">Chồng</option>
                  <option value="anh_chi_em">Anh / Chị / Em</option>
                  <option value="khac">Khác</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Giới tính *</label>
                <select
                  value={memberFormGender}
                  onChange={(e) => setMemberFormGender(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  required
                >
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                  <option value="khac">Khác</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Số điện thoại riêng (tùy chọn)"
                placeholder="Để trống sẽ dùng SĐT của chủ tài khoản"
                value={memberFormPhone}
                onChange={(e) => setMemberFormPhone(normalizePhoneInput(e.target.value))}
                maxLength={10}
              />
              <Input
                label="Nhóm máu (tùy chọn)"
                placeholder="Ví dụ: A, B, O, AB..."
                value={memberFormBlood}
                onChange={(e) => setMemberFormBlood(e.target.value)}
              />
            </div>

            <Input
              label="Dị ứng thuốc / thức ăn (tùy chọn)"
              placeholder="Ví dụ: Dị ứng Penicillin, dị ứng hải sản..."
              value={memberFormAllergy}
              onChange={(e) => setMemberFormAllergy(e.target.value)}
            />

            <Input
              label="Tiền sử bệnh lý / Bệnh nền (tùy chọn)"
              placeholder="Ví dụ: Viêm xoang mãn tính, hen phế quản..."
              value={memberFormBackground}
              onChange={(e) => setMemberFormBackground(e.target.value)}
            />

            <div className="flex gap-4 justify-end border-t border-slate-50 pt-4 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMemberModalOpen(false)
                  clearMemberForm()
                }}
              >
                Đóng
              </Button>
              <Button type="submit" loading={familyLoading}>
                {editingMemberId ? 'Lưu thay đổi' : 'Thêm thành viên'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {detailModalOpen && selectedAppointment && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false)
            setSelectedAppointment(null)
            setContactEditOpen(false)
          }}
          title="CHI TIẾT LỊCH HẸN KHÁM"
        >
          <div className="space-y-6 text-left">
            {/* Lịch hẹn status banner */}
            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Mã lịch hẹn</p>
                <p className="text-lg font-black text-brand-700">{selectedAppointment.id.toUpperCase()}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusBadge(selectedAppointment.status)}`}>
                  {getStatusLabel(selectedAppointment.status)}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-105 px-2.5 py-0.5 text-xs font-bold text-slate-650 mt-1">
                  {getPaymentLabel(selectedAppointment.payment_status)}
                </span>
              </div>
            </div>

            {/* Thông tin bệnh nhân được đặt khám */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Thông tin bệnh nhân khám</p>
                <div className="flex items-center gap-2">
                  {canEditAppointmentContact(selectedAppointment) && !contactEditOpen && (
                    <button
                      type="button"
                      onClick={() => setContactEditOpen(true)}
                      className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    {selectedAppointment.member_id
                      ? 'Thành viên gia đình'
                      : selectedAppointment.ten_khach && selectedAppointment.ten_khach !== user?.ho_ten
                      ? 'Đặt hộ người thân'
                      : 'Tài khoản chính (Bản thân)'}
                  </span>
                </div>
              </div>
              {contactEditOpen ? (
                <form onSubmit={handleUpdateAppointmentContact} className="space-y-3 pt-2">
                  <Input
                    label="Họ và tên bệnh nhân"
                    value={contactEditName}
                    onChange={(event) => setContactEditName(event.target.value)}
                    onBlur={() => setContactEditName((current) => normalizePersonName(current))}
                    required
                  />
                  <Input
                    label="Số điện thoại liên hệ"
                    value={contactEditPhone}
                    onChange={(event) => setContactEditPhone(normalizePhoneInput(event.target.value))}
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs leading-5 text-blue-700">Thay đổi này chỉ áp dụng cho lịch hẹn hiện tại, không thay đổi hồ sơ cá nhân.</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setContactEditOpen(false)}>Hủy</Button>
                    <Button type="submit" loading={contactSaving}>Lưu thông tin</Button>
                  </div>
                </form>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 text-sm pt-1">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Họ và tên bệnh nhân:</p>
                    <p className="font-bold text-slate-800">{selectedAppointment.ten_khach || user?.ho_ten}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Số điện thoại liên hệ:</p>
                    <p className="font-bold text-slate-800">{selectedAppointment.so_dien_thoai_khach || user?.so_dien_thoai || 'Chưa cập nhật'}</p>
                  </div>
                  {selectedAppointment.nam_sinh_khach && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Năm sinh:</p>
                      <p className="font-semibold text-slate-700">{selectedAppointment.nam_sinh_khach}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bác sĩ phụ trách</p>
                <p className="font-bold text-slate-800 mt-1">{selectedAppointment.bac_si.ho_ten}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAppointment.ten_dich_vu || 'Chuyên khoa Tai Mũi Họng'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Thời gian khám</p>
                <p className="font-bold text-slate-800 mt-1">{selectedAppointment.gio_kham}</p>
                <p className="text-xs text-slate-500 mt-0.5">Ngày {new Date(selectedAppointment.ngay_kham).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="border-b border-slate-100 pb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Địa điểm khám</p>
                <p className="font-semibold text-slate-800 mt-1">🏠 {selectedAppointment.phong_kham ? `${selectedAppointment.phong_kham} - Phòng khám Tai Mũi Họng ViteFamily` : 'Phòng 102 - Tầng 1 - Phòng khám Tai Mũi Họng ViteFamily'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedAppointment.dia_chi_kham || 'Thành phố Hà Nội'}</p>
              </div>

              {selectedAppointment.ly_do_kham && (
                <div className="border-b border-slate-100 pb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Triệu chứng / Lý do khám</p>
                  <p className="text-slate-700 mt-1">{selectedAppointment.ly_do_kham}</p>
                </div>
              )}

              {selectedAppointment.status === 'completed' && selectedAppointment.ket_qua && (
                <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Kết quả sau khám</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {selectedAppointment.ket_qua.chan_doan || 'Chưa có chẩn đoán chi tiết.'}
                    </p>
                  </div>
                  {selectedAppointment.ket_qua.huong_dan_dieu_tri && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Hướng dẫn điều trị</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedAppointment.ket_qua.huong_dan_dieu_tri}</p>
                    </div>
                  )}
                  {selectedAppointment.ket_qua.hinh_anh_noi_soi && selectedAppointment.ket_qua.hinh_anh_noi_soi.length > 0 && (
                    <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-sky-800 flex items-center gap-1.5">
                          <span>📸</span> Hình ảnh nội soi / Kết quả dịch vụ
                        </p>
                        <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                          {selectedAppointment.ket_qua.hinh_anh_noi_soi.length} ảnh
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {selectedAppointment.ket_qua.hinh_anh_noi_soi.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveEndoscopyImage(img)}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-sky-500 hover:shadow-md text-left"
                          >
                            <img
                              src={resolveMediaUrl(img.url) || ''}
                              alt={img.mo_ta || `Ảnh nội soi ${idx + 1}`}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            {img.mo_ta && (
                              <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-1 backdrop-blur-[2px]">
                                <p className="truncate text-[10px] font-medium text-white">{img.mo_ta}</p>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-sky-900/20 opacity-0 transition group-hover:opacity-100 flex items-center justify-center">
                              <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-sky-700 shadow-sm">🔍 Phóng to</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAppointment.ket_qua.thuoc.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Đơn thuốc</p>
                      <ul className="mt-2 space-y-2">
                        {selectedAppointment.ket_qua.thuoc.map((thuoc, index) => (
                          <li key={index} className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">
                            {typeof thuoc === 'string'
                              ? thuoc
                              : `${thuoc.ten_thuoc || 'Thuốc'}${thuoc.lieu_luong ? ` · ${thuoc.lieu_luong}` : ''}${thuoc.tan_suat ? ` · ${thuoc.tan_suat}` : ''}${thuoc.so_ngay ? ` · ${thuoc.so_ngay} ngày` : ''}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Bảng kê chi phí dịch vụ khám & thanh toán */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span>🧾</span> Chi phí dịch vụ khám
                  </p>
                  {selectedAppointment.hoa_don?.so_hoa_don && (
                    <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">
                      HĐ: {selectedAppointment.hoa_don.so_hoa_don}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {/* Phí khám ban đầu */}
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Phí dịch vụ khám ({selectedAppointment.ten_dich_vu || 'Khám chuyên khoa'})</span>
                    <span className="font-semibold text-slate-800">
                      {(selectedAppointment.hoa_don?.tong_tien_kham ?? selectedAppointment.gia_kham).toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  {/* Chi tiết các dịch vụ phát sinh do bác sĩ chỉ định (nếu có) */}
                  {((selectedAppointment.hoa_don?.chi_tiet_thu_phi && selectedAppointment.hoa_don.chi_tiet_thu_phi.filter((item) => item.loai !== 'phi_kham').length > 0) ||
                    (selectedAppointment.ket_qua?.dich_vu_phat_sinh && selectedAppointment.ket_qua.dich_vu_phat_sinh.length > 0)) && (
                    <div className="pt-2 border-t border-slate-200/50 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Dịch vụ chỉ định phát sinh:</p>

                      {selectedAppointment.hoa_don?.chi_tiet_thu_phi && selectedAppointment.hoa_don.chi_tiet_thu_phi.filter((item) => item.loai !== 'phi_kham').length > 0
                        ? selectedAppointment.hoa_don.chi_tiet_thu_phi
                            .filter((item) => item.loai !== 'phi_kham')
                            .map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-slate-600 pl-2.5 border-l-2 border-teal-500">
                                <span>
                                  {item.ten || 'Dịch vụ chỉ định'} {item.so_luong && item.so_luong > 1 ? `(x${item.so_luong})` : ''}
                                </span>
                                <span className="font-semibold text-slate-800">{(item.thanh_tien || (item.so_tien || 0) * (item.so_luong || 1)).toLocaleString('vi-VN')} đ</span>
                              </div>
                            ))
                        : selectedAppointment.ket_qua?.dich_vu_phat_sinh?.map((dv, idx) => (
                            <div key={idx} className="flex justify-between items-center text-slate-600 pl-2.5 border-l-2 border-teal-500">
                              <span>
                                {dv.ten} {dv.so_luong && dv.so_luong > 1 ? `(x${dv.so_luong})` : ''}
                              </span>
                              <span className="font-semibold text-slate-800">{(dv.thanh_tien || (dv.don_gia || 0) * (dv.so_luong || 1)).toLocaleString('vi-VN')} đ</span>
                            </div>
                          ))}
                    </div>
                  )}

                  {/* Tổng chi phí thanh toán */}
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">TỔNG CHI PHÍ KHÁM</p>
                      <p className="text-[10px] text-teal-700 font-medium">
                        {selectedAppointment.payment_status === 'paid' || selectedAppointment.hoa_don?.trang_thai_hoa_don === 'da_thanh_toan_du'
                          ? '✓ Đã thanh toán đầy đủ'
                          : 'Đã thanh toán online'}
                      </p>
                    </div>
                    <p className="text-base font-black text-teal-700">
                      {(
                        selectedAppointment.hoa_don?.tong_thanh_toan ??
                        ((selectedAppointment.hoa_don?.tong_tien_kham ?? selectedAppointment.gia_kham) +
                          (selectedAppointment.hoa_don?.tong_tien_phat_sinh ??
                            (selectedAppointment.ket_qua?.dich_vu_phat_sinh?.reduce((acc, curr) => acc + (curr.thanh_tien || (curr.don_gia || 0) * (curr.so_luong || 1)), 0) || 0)))
                      ).toLocaleString('vi-VN')}{' '}
                      đ
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDetailModalOpen(false)
                  setSelectedAppointment(null)
                }}
                className="w-full sm:w-auto"
              >
                Đóng lại
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {cancelModalId && (() => {
        const selectedCancelApp = appointments.find((a) => a.id === cancelModalId)
        let isWithin24h = false
        let isPaid = false
        if (selectedCancelApp) {
          isPaid = selectedCancelApp.payment_status === 'paid'
          try {
            const appDate = new Date(selectedCancelApp.ngay_kham)
            if (selectedCancelApp.gio_kham && selectedCancelApp.gio_kham.includes(':')) {
              const [h, m] = selectedCancelApp.gio_kham.split(':').map(Number)
              appDate.setHours(h, m, 0, 0)
            }
            isWithin24h = (appDate.getTime() - Date.now()) < 24 * 3600 * 1000
          } catch {}
        }
        return (
          <Modal
            isOpen={!!cancelModalId}
            onClose={() => setCancelModalId(null)}
            title="XÁC NHẬN HỦY LỊCH HẸN"
          >
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-600">
                Bạn có chắc chắn muốn hủy lịch hẹn khám này không? Hành động này sẽ tác động trực tiếp lên dữ liệu thật của hệ thống.
              </p>

              {isPaid && selectedCancelApp && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-3.5 text-left text-xs space-y-1">
                  <p className="font-bold text-orange-800 uppercase tracking-wider">Chính sách hoàn tiền:</p>
                  {isWithin24h ? (
                    <p className="text-orange-700">
                      Lịch khám diễn ra trong vòng 24h tới. Nếu hủy lúc này, quý khách chỉ được <strong>hoàn tiền 50%</strong> ({((selectedCancelApp.gia_kham || 0) * 0.5).toLocaleString('vi-VN')}đ) theo quy định của phòng khám.
                    </p>
                  ) : (
                    <p className="text-orange-700">
                      Lịch khám diễn ra còn hơn 24h nữa. Quý khách sẽ được <strong>hoàn tiền 100%</strong> ({selectedCancelApp.gia_kham.toLocaleString('vi-VN')}đ).
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setCancelModalId(null)}>Đóng</Button>
                <Button variant="primary" className="bg-red-600 text-white hover:bg-red-700" onClick={confirmCancel}>Xác nhận hủy</Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {rescheduleAppId && (
        <RescheduleModal
          appointmentId={rescheduleAppId}
          onClose={() => setRescheduleAppId(null)}
          onDone={(thongBao) => {
            setRescheduleAppId(null)
            setToast(thongBao)
            void loadAppointments()
          }}
        />
      )}

      {/* Rule mục 5: KHÔNG hoàn tiền trong mọi trường hợp. Bản cũ ở đây hứa hoàn 50%/100%
          tuỳ mốc 24h — trái hẳn điều khoản khách đã ký lúc đặt, và là loại mâu thuẫn dẫn
          thẳng tới tranh chấp. Nay nói đúng chính sách và hướng khách sang DỜI LỊCH, thứ
          họ thực sự được hưởng. */}
      {refundHelpAppId && (() => {
        const selectedApp = appointments.find((a) => a.id === refundHelpAppId)
        return (
          <Modal
            isOpen={!!refundHelpAppId}
            onClose={() => setRefundHelpAppId(null)}
            title="HỦY LỊCH KHÁM"
          >
            <div className="space-y-4 text-left">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">
                <p className="font-bold">Huỷ lịch đồng nghĩa mất toàn bộ số tiền đã thanh toán
                  {selectedApp ? ` (${selectedApp.gia_kham.toLocaleString('vi-VN')}đ)` : ''}.</p>
                <p className="mt-2">
                  Phòng khám không hoàn tiền — đây là điều khoản bạn đã đồng ý khi đặt lịch.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
                <p className="font-bold">Bạn nên dời lịch thay vì huỷ.</p>
                <p className="mt-2">
                  Dời lịch giữ nguyên số tiền đã trả và bạn được dời một lần miễn phí. Nếu không
                  đến được vào giờ đã hẹn, chỉ cần dời trước giờ khám 30 phút.
                </p>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                Nếu bạn cho rằng đây là lỗi từ phía phòng khám (bác sĩ nghỉ, đổi lịch...), vui lòng
                liên hệ hotline <strong>0365 747888</strong> — những trường hợp đó được dời lịch mà
                không tính vào hạn mức của bạn.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setRefundHelpAppId(null)}>Để sau</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const id = refundHelpAppId
                    setRefundHelpAppId(null)
                    setRescheduleAppId(id)
                  }}
                >
                  Dời lịch thay vì huỷ
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {reviewModalOpen && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false)
            setSelectedReviewApp(null)
          }}
          appointment={selectedReviewApp}
          onSuccess={() => {
            setToast('Cảm ơn bạn đã gửi đánh giá!')
            fetchReviews(reviewPage)
          }}
        />
      )}

      {/* Modal Thanh toán VNPAY lại khi bấm Thanh toán ngay */}
      {payModalApp && (
        <Modal
          isOpen={Boolean(payModalApp)}
          onClose={() => setPayModalApp(null)}
          title="Thanh toán VNPAY cho lịch hẹn"
        >
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-slate-50 p-3 text-left text-xs space-y-1 border border-slate-200">
              <p><strong className="text-slate-700">Mã lịch hẹn:</strong> {payModalApp.id.slice(-6).toUpperCase()}</p>
              <p><strong className="text-slate-700">Bệnh nhân:</strong> {payModalApp.ten_khach || user?.ho_ten}</p>
              <p><strong className="text-slate-700">Dịch vụ:</strong> {payModalApp.ten_dich_vu}</p>
              <p><strong className="text-slate-700">Thời gian:</strong> {payModalApp.gio_kham}, ngày {new Date(payModalApp.ngay_kham).toLocaleDateString('vi-VN')}</p>
              <p className="text-sm font-extrabold text-teal-700 pt-1">
                Phí thanh toán: {payModalApp.gia_kham.toLocaleString('vi-VN')} đ
              </p>
            </div>

            {payLoading ? (
              <div className="py-8 text-sm text-slate-500 font-medium">Đang khởi tạo mã QR VNPAY...</div>
            ) : payQrUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative rounded-2xl border-2 border-teal-200 bg-white p-3 shadow-md">
                  <img src={payQrUrl} alt="Mã QR VNPAY" className="h-56 w-56 object-contain" />
                </div>
                <p className="text-xs text-slate-500">
                  Quét mã QR bằng ứng dụng ngân hàng hoặc VNPAY để hoàn tất thanh toán.
                </p>
                {paySnapshot?.gateway?.expires_at && (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    ⏱️ Thời gian giữ chỗ còn: <strong>{getPaymentDeadlineCountdown(paySnapshot.gateway.expires_at, nowMs, serverTimeOffset) || 'Đã hết hạn'}</strong>
                  </p>
                )}
                {paySnapshot?.gateway?.payment_url && (
                  <Button
                    variant="primary"
                    onClick={() => window.open(paySnapshot.gateway.payment_url!, '_blank', 'noopener,noreferrer')}
                    className="mt-1 bg-teal-700 hover:bg-teal-800 text-xs font-bold"
                  >
                    Mở trang thanh toán VNPAY
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-4 text-sm text-red-600 font-medium">
                Không thể tạo được mã QR VNPAY cho lịch hẹn này.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setPayModalApp(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}

      {/* Endoscopy Lightbox Modal */}
      {activeEndoscopyImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveEndoscopyImage(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-2xl bg-white p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveEndoscopyImage(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition font-bold"
            >
              ✕
            </button>
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 flex items-center gap-1.5">
                <span>📸</span> Hình ảnh nội soi chi tiết
              </p>
              <img
                src={resolveMediaUrl(activeEndoscopyImage.url) || ''}
                alt={activeEndoscopyImage.mo_ta || 'Ảnh nội soi'}
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-sm border border-slate-100"
              />
              {activeEndoscopyImage.mo_ta && (
                <p className="mt-3 text-center text-sm font-semibold text-slate-800 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200/80">
                  {activeEndoscopyImage.mo_ta}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </RouteTransition>
  )
}
