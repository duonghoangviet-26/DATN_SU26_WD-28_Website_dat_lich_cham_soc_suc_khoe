import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'

import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Loading from '@/components/common/Loading'
import Textarea from '@/components/common/Textarea'
import Toast from '@/components/common/Toast'
import { useAuth } from '@/context/AuthContext'
import {
  patientBookingService,
  type CreatedBookingResult,
  type PatientPaymentStatusResult,
  type FamilyMember,
  type CreateBookingPayload,
  type SpecialtySlotsResult,
} from '@/services/patient-booking.service'
import { specialtyService } from '@/services/specialty.service'
import DieuKhoanDatLich from '@/components/client/DieuKhoanDatLich'

type BookingStep = 1 | 2 | 3 | 4 | 5

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatGatewayExpiry(expiresAt: string | null) {
  if (!expiresAt) return '--'
  return new Date(expiresAt).toLocaleString('vi-VN')
}

function getCountdownLabel(expiresAt: string | null, nowMs: number) {
  if (!expiresAt) return null
  const distance = new Date(expiresAt).getTime() - nowMs
  if (distance <= 0) return 'Mã QR đã hết hạn'

  const totalSeconds = Math.floor(distance / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default function Booking() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!authLoading && !user) {
      const params = searchParams.toString()
      const redirectPath = params ? `/booking?${params}` : '/booking'
      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    }
  }, [user, authLoading, searchParams, navigate])

  // ── Helpers đọc/ghi sessionStorage cho booking ──
  const BOOKING_SS_KEY = 'booking_draft'

  function readBookingDraft() {
    try {
      const raw = sessionStorage.getItem(BOOKING_SS_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  const draft = readBookingDraft()

  // ── Xóa draft khi người dùng rời trang Booking bằng SPA Navigation (chuyển qua Bác sĩ, Dịch vụ...), 
  // nhưng GIỮ LẠI draft nếu người dùng chỉ bấm F5 (reload trang) ──
  useEffect(() => {
    let isUnloading = false

    const handleBeforeUnload = () => {
      isUnloading = true
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Nếu unmount do chuyển trang SPA (isUnloading === false), tiến hành xóa nháp.
      if (!isUnloading) {
        sessionStorage.removeItem(BOOKING_SS_KEY)
      }
    }
  }, [])

  const [step, setStep] = useState<BookingStep>(() => {
    const saved = draft?.step as BookingStep | undefined
    if (saved && saved >= 2 && saved <= 5) {
      if (saved === 5 && !draft?.createdBooking) return 1
      return saved
    }
    return 1
  })
  const [selectedDate, setSelectedDate] = useState<string>(draft?.selectedDate || '')
  // Bằng chứng đồng ý điều khoản không hoàn tiền — backend từ chối tạo lịch nếu thiếu
  // (rule mục 5: không có bằng chứng thì không được thu tiền).
  const [dongYDieuKhoan, setDongYDieuKhoan] = useState(false)

  const [khungTheoChuyenKhoa, setKhungTheoChuyenKhoa] = useState<SpecialtySlotsResult | null>(null)
  const [dangTaiKhungCK, setDangTaiKhungCK] = useState(false)
  const [khungGioDaChon, setKhungGioDaChon] = useState<string>(draft?.khungGioDaChon || '')

  // Booking target states
  const [bookingFor, setBookingFor] = useState<'self' | 'member' | 'other'>(() => {
    const qBookingFor = searchParams.get('booking_for')
    if (qBookingFor === 'member') return 'member'
    if (searchParams.get('member_id')) return 'member'
    return draft?.bookingFor || 'self'
  })
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
    return searchParams.get('member_id') || draft?.selectedMemberId || ''
  })

  const [patientName, setPatientName] = useState(draft?.patientName || user?.ho_ten || '')
  const [patientPhone, setPatientPhone] = useState(draft?.patientPhone || user?.so_dien_thoai || '')
  const [symptoms, setSymptoms] = useState(draft?.symptoms || '')

  // Inline field validation states
  const [fieldErrors, setFieldErrors] = useState<{ patientName?: string; patientPhone?: string; symptoms?: string }>({})
  const [touchedFields, setTouchedFields] = useState<{ patientName?: boolean; patientPhone?: boolean; symptoms?: boolean }>({})

  const [toast, setToast] = useState<string | null>(null)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [creatingPaymentSession, setCreatingPaymentSession] = useState(false)
  const [cancellingPayment, setCancellingPayment] = useState(false)

  // Specialty filters
  const [specialties, setSpecialties] = useState<{ id: string; ten: string }[]>([])
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>(draft?.selectedSpecialtyId || 'all')
  const [loadingSpecialties, setLoadingSpecialties] = useState(false)

  const [dates, setDates] = useState<{ value: string; label: string }[]>([])
  const [createdBooking, setCreatedBooking] = useState<CreatedBookingResult | null>(draft?.createdBooking || null)
  const [paymentSnapshot, setPaymentSnapshot] = useState<PatientPaymentStatusResult | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  // ── Ghi lại trạng thái booking vào sessionStorage khi thay đổi ──
  useEffect(() => {
    // Không lưu bước 1 (chưa bắt đầu)
    if (step <= 1) {
      sessionStorage.removeItem(BOOKING_SS_KEY)
      return
    }
    const data = {
      step,
      selectedSpecialtyId,
      selectedDate,
      khungGioDaChon,
      bookingFor,
      selectedMemberId,
      patientName,
      patientPhone,
      symptoms,
      createdBooking,
    }
    sessionStorage.setItem(BOOKING_SS_KEY, JSON.stringify(data))
  }, [step, selectedSpecialtyId, selectedDate, khungGioDaChon, bookingFor, selectedMemberId, patientName, patientPhone, symptoms, createdBooking])

  useEffect(() => {
    const datesList: { value: string; label: string }[] = []
    const today = new Date()
    // Duyệt tối đa 14 ngày tới để lấy 7 ngày gần nhất có thể chọn.
    // Backend quyết định ngày đó có slot hay không theo lịch làm việc thực tế của bác sĩ.
    for (let i = 0; i < 14 && datesList.length < 7; i++) {
      const nextDate = new Date(today)
      nextDate.setDate(today.getDate() + i)
      // Demo 09/08/2026: DB co lich lam viec Chu nhat, nen tam thoi khong chan Chu nhat o client.
      // if (nextDate.getDay() === 0) continue // Bo qua Chu nhat
      const yyyy = nextDate.getFullYear()
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0')
      const dd = String(nextDate.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const weekday = nextDate.toLocaleDateString('vi-VN', { weekday: 'short' })
      const day = nextDate.getDate()
      const month = nextDate.getMonth() + 1
      const label = `${weekday}, ${day}/${month}`
      datesList.push({ value: dateStr, label })
    }
    setDates(datesList)
    if (datesList.length > 0) {
      setSelectedDate((prev) => prev || draft?.selectedDate || datesList[0].value)
    }
  }, [])

  useEffect(() => {
    if (user) {
      if (bookingFor === 'self') {
        setPatientName((prev) => prev || draft?.patientName || user.ho_ten)
        setPatientPhone((prev) => prev || draft?.patientPhone || user.so_dien_thoai || '')
      }

      let ignore = false
      patientBookingService.getFamilyGroup()
        .then((group) => {
          if (!ignore && group) {
            const actualMembers = (group.members || []).filter((m) => !m.la_chu_ho)
            setFamilyMembers(actualMembers)

            const qMemberId = searchParams.get('member_id')
            const qBookingFor = searchParams.get('booking_for')
            if (qBookingFor === 'member' || qMemberId) {
              const target = actualMembers.find((m) => m.id === qMemberId) || actualMembers[0]
              if (target) {
                setBookingFor('member')
                setSelectedMemberId(target.id)
                setPatientName(target.ho_ten)
                setPatientPhone(target.so_dien_thoai || user.so_dien_thoai || '')
              }
            } else if (bookingFor === 'member') {
              const target = actualMembers.find((m) => m.id === selectedMemberId) || actualMembers[0]
              if (target) {
                setSelectedMemberId(target.id)
                setPatientName(target.ho_ten)
                setPatientPhone(target.so_dien_thoai || user.so_dien_thoai || '')
              }
            }
          }
        })
        .catch(() => {})

      return () => {
        ignore = true
      }
    }
  }, [user])

  useEffect(() => {
    let ignore = false
    setLoadingSpecialties(true)
    specialtyService.getAllActive()
      .then((data) => {
        if (!ignore) {
          setSpecialties(data)
          if (data.length > 0) {
            setSelectedSpecialtyId((prev) => (prev && prev !== 'all' ? prev : draft?.selectedSpecialtyId || data[0].id))
            setStep((prevStep) => (prevStep && prevStep >= 2 ? prevStep : draft?.step && draft.step >= 2 ? draft.step : 2))
          }
        }
      })
      .catch((err) => {
        console.error('Không tải được danh sách chuyên khoa:', err)
      })
      .finally(() => {
        if (!ignore) setLoadingSpecialties(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Nạp khung giờ gộp của TẤT CẢ bác sĩ thuộc chuyên khoa, kèm giá khám.
  useEffect(() => {
    if (selectedSpecialtyId === 'all' || !selectedDate) {
      setKhungTheoChuyenKhoa(null)
      return
    }

    let ignore = false
    setDangTaiKhungCK(true)
    patientBookingService.getSpecialtySlots(selectedSpecialtyId, selectedDate)
      .then((data) => { if (!ignore) setKhungTheoChuyenKhoa(data) })
      .catch((error: any) => {
        if (!ignore) {
          setKhungTheoChuyenKhoa(null)
          setToast(error.response?.data?.message || 'Không tải được khung giờ của chuyên khoa')
        }
      })
      .finally(() => { if (!ignore) setDangTaiKhungCK(false) })

    return () => { ignore = true }
  }, [selectedSpecialtyId, selectedDate])

  useEffect(() => {
    if (step !== 5 || !createdBooking?.payment_id) return

    let ignore = false
    setCreatingPaymentSession(true)
    patientBookingService.createVnpaySession(createdBooking.payment_id)
      .then((data) => {
        if (!ignore) setPaymentSnapshot(data)
      })
      .catch((error: any) => {
        if (!ignore) {
          setToast(error.response?.data?.message || error.message || 'Không tạo được mã QR VNPAY')
        }
      })
      .finally(() => {
        if (!ignore) setCreatingPaymentSession(false)
      })

    return () => {
      ignore = true
    }
  }, [step, createdBooking?.payment_id])

  useEffect(() => {
    if (!paymentSnapshot?.gateway.qr_payload) {
      setQrCodeDataUrl('')
      return
    }

    let cancelled = false
    QRCode.toDataURL(paymentSnapshot.gateway.qr_payload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrCodeDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeDataUrl('')
          setToast('Không render được mã QR VNPAY')
        }
      })

    return () => {
      cancelled = true
    }
  }, [paymentSnapshot?.gateway.qr_payload])

  useEffect(() => {
    if (step !== 5 || !createdBooking?.payment_id || paymentSnapshot?.payment_status !== 'pending') return

    let cancelled = false
    const intervalId = window.setInterval(() => {
      patientBookingService.getPaymentStatus(createdBooking.payment_id)
        .then((data) => {
          if (!cancelled) setPaymentSnapshot(data)
        })
        .catch(() => {
          // Keep the existing snapshot if polling fails transiently.
        })
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [step, createdBooking?.payment_id, paymentSnapshot?.payment_status])

  useEffect(() => {
    if (step !== 5 || paymentSnapshot?.payment_status !== 'pending' || paymentSnapshot.gateway.is_expired) return

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [step, paymentSnapshot?.payment_status, paymentSnapshot?.gateway.is_expired])

  useEffect(() => {
    if (step === 5 && paymentSnapshot?.payment_status === 'paid' && paymentSnapshot.appointment_status === 'confirmed') {
      sessionStorage.removeItem(BOOKING_SS_KEY)
      navigate(`/profile?booked=true&id=${createdBooking?.id || createdBooking?.appointment_id || ''}`, { replace: true })
    }
  }, [step, paymentSnapshot?.payment_status, paymentSnapshot?.appointment_status, createdBooking, navigate])

  const countdownLabel = getCountdownLabel(paymentSnapshot?.gateway.expires_at || null, nowMs)
  const selectedSpecialty = specialties.find((specialty) => specialty.id === selectedSpecialtyId)
  const selectedDateLabel = dates.find((date) => date.value === selectedDate)?.label || selectedDate

  function handleNextStep() {
    if (step === 1) {
      if (selectedSpecialtyId === 'all') {
        setToast('Vui lòng chọn chuyên khoa bạn muốn khám.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      if (!selectedDate) {
        setToast('Vui lòng chọn ngày khám.')
        return
      }
      if (!khungGioDaChon) {
        setToast('Vui lòng chọn khung giờ còn trống.')
        return
      }
      setStep(3)
      return
    }

    if (step === 3) {
      if (bookingFor === 'member' && !selectedMemberId) {
        setToast('Vui lòng chọn một thành viên trong gia đình hoặc chọn Nhập người mới.')
        return
      }

      const nameErr = bookingFor === 'other' ? validatePatientName(patientName) : undefined
      const phoneErr = validatePatientPhone(patientPhone)
      const symptomsErr = validateSymptoms(symptoms)

      const newErrors = {
        patientName: nameErr,
        patientPhone: phoneErr,
        symptoms: symptomsErr,
      }

      setFieldErrors(newErrors)
      setTouchedFields({ patientName: true, patientPhone: true, symptoms: true })

      if (nameErr || phoneErr || symptomsErr) {
        const firstErr = phoneErr || symptomsErr || nameErr
        if (firstErr) setToast(firstErr)
        return
      }

      setStep(4)
    }
  }

  function validatePatientName(val: string): string | undefined {
    const nameTrimmed = val.trim().replace(/[()_-]/g, ' ').replace(/\s+/g, ' ')
    if (!nameTrimmed) return 'Vui lòng nhập họ và tên người khám.'
    const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠƯưăâêôơưẠ-ỹđĐ\s'.]{2,100}$/
    if (!nameRegex.test(nameTrimmed)) {
      return 'Họ tên bệnh nhân không hợp lệ (tối thiểu 2 ký tự, chỉ chứa chữ cái).'
    }
    return undefined
  }

  function validatePatientPhone(val: string): string | undefined {
    const phoneTrimmed = val.trim()
    if (!phoneTrimmed) return 'Vui lòng nhập số điện thoại liên hệ.'
    const phoneRegex = /^0\d{9}$/
    if (!phoneRegex.test(phoneTrimmed)) {
      return 'Số điện thoại liên hệ không hợp lệ (phải gồm 10 chữ số, ví dụ 0912345678).'
    }
    return undefined
  }

  function validateSymptoms(val: string): string | undefined {
    const symptomsTrimmed = val.trim()
    if (!symptomsTrimmed) return 'Vui lòng mô tả sơ qua triệu chứng bệnh.'
    if (symptomsTrimmed.length < 5) return 'Mô tả triệu chứng quá ngắn (tối thiểu 5 ký tự).'
    return undefined
  }

  function handlePrevStep() {
    if (step === 5) {
      return
    }
    // Chuyên khoa đã được cấu hình sẵn cho phòng khám Tai Mũi Họng.
    // Không quay lại màn hình chọn chuyên khoa trong luồng đặt lịch online.
    if (step > 2) {
      setStep((prev) => (prev - 1) as BookingStep)
    }
  }

  async function handleCreateBooking() {
    if (selectedSpecialtyId === 'all' || !khungGioDaChon) {
      setToast('Thiếu thông tin khung giờ khám.')
      return
    }
    // Backend cũng chặn (rule mục 5: không có bằng chứng đồng ý thì không được thu tiền).
    // Chặn ở đây chỉ để khách nhận thông báo ngay thay vì đợi một vòng gọi API.
    if (!dongYDieuKhoan) {
      setToast('Vui lòng đọc và tích vào ô đồng ý điều khoản đặt lịch trước khi xác nhận.')
      return
    }

    setSubmittingBooking(true)
    try {
      // Khách chỉ gửi chuyên khoa + khung giờ; backend chọn bác sĩ còn suất theo quy tắc xác định.
      const payload: CreateBookingPayload = {
        loai_kham: 'clinic',
        specialty_id: selectedSpecialtyId,
        gio_bat_dau: khungGioDaChon,
        ngay_kham: selectedDate,
        ly_do_kham: symptoms.trim(),
        ten_khach: patientName.trim(),
        so_dien_thoai_khach: patientPhone.trim(),
        booking_for: bookingFor,
        phuong_thuc: 'chuyen_khoan',
        dong_y_dieu_khoan: true,
      }

      if (bookingFor === 'member' && selectedMemberId) {
        payload.member_id = selectedMemberId
      }

      const created = await patientBookingService.createBooking(payload)
      setCreatedBooking(created)
      setPaymentSnapshot(null)
      setQrCodeDataUrl('')
      setStep(5)
      setToast('Đã tạo lịch hẹn chờ thanh toán. Hệ thống đang tạo mã QR VNPAY mock.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Tạo lịch hẹn thất bại')
    } finally {
      setSubmittingBooking(false)
    }
  }

  async function handleOpenVnpayPage() {
    if (!paymentSnapshot?.gateway.payment_url) return
    window.open(paymentSnapshot.gateway.payment_url, '_blank', 'noopener,noreferrer')
  }

  async function handleCancelPayment() {
    if (!createdBooking?.appointment_id || cancellingPayment) return
    if (!window.confirm('Bạn có chắc muốn hủy thanh toán và trả lại khung giờ khám không?')) return

    setCancellingPayment(true)
    try {
      await patientBookingService.cancelBooking(createdBooking.appointment_id, 'Khách hàng hủy thanh toán tại bước thanh toán')
      sessionStorage.removeItem(BOOKING_SS_KEY)
      navigate('/profile?cancelled=true', { replace: true })
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không thể hủy thanh toán')
    } finally {
      setCancellingPayment(false)
    }
  }

  function handleDateChange(dateValue: string) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    if (dateValue < todayStr) {
      setToast('Không được chọn ngày khám trong quá khứ.')
      return
    }

    // Demo 09/08/2026: DB co lich lam viec Chu nhat, nen tam thoi khong chan Chu nhat o client.
    // const picked = new Date(dateValue + 'T00:00:00')
    // if (picked.getDay() === 0) {
    //   setToast('Phòng khám không làm việc vào Chủ nhật. Vui lòng chọn ngày khác (Thứ 2 – Thứ 7).')
    //   return
    // }

    if (selectedDate !== dateValue) {
      setSelectedDate(dateValue)
      setKhungGioDaChon('')
    }
  }

  if (authLoading || loadingSpecialties) {
    return <Loading message="Đang tải dữ liệu đặt lịch..." />
  }

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 sm:space-y-6">
      <Breadcrumb items={[{ label: 'Đặt lịch khám' }]} />

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-left sm:px-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl space-y-2">
            <p className="text-sm font-semibold text-brand-700">Khám Tai Mũi Họng tại ViteFamily</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Chọn một khung giờ phù hợp</h1>
            <p className="text-sm leading-6 text-slate-600">
              Bạn không cần chọn bác sĩ. Chỉ cần chọn ngày, khung giờ và mô tả triệu chứng, phòng khám sẽ sắp xếp bác sĩ còn lịch phù hợp.
            </p>
          </div>
          <div className="flex max-w-sm items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-5 text-brand-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.74 3h15.72A2 2 0 0 0 21.6 18L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            Suất trống được xác nhận lại khi bạn hoàn tất đặt lịch.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex min-w-[560px] items-center text-center">
        {[
          { num: 2, label: 'Thời gian' },
          { num: 3, label: 'Triệu chứng' },
          { num: 4, label: 'Xác nhận lịch' },
          { num: 5, label: 'Thanh toán' },
        ].map((item, index) => (
          <div key={item.num} className="relative flex min-w-28 flex-1 flex-col items-center gap-2">
            {item.num < 5 && (
              <span className={`absolute left-[calc(50%+18px)] top-4 h-px w-[calc(100%-36px)] ${step > item.num ? 'bg-brand-500' : 'bg-slate-200'}`} />
            )}
            <div
              className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${
                step > item.num ? 'bg-brand-600 text-white' : step === item.num ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > item.num ? '✓' : index + 1}
            </div>
            <p className={`text-xs font-semibold ${step >= item.num ? 'text-slate-800' : 'text-slate-400'}`}>
              {item.label}
            </p>
          </div>
        ))}
        </div>
      </div>

      {step === 2 && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-left sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Chọn thời gian khám</h2>
                <p className="mt-1 text-sm text-slate-600">Các thời điểm hiển thị đều còn ít nhất một bác sĩ có thể tiếp nhận.</p>
              </div>
              
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="booking-date" className="font-medium text-slate-600">Ngày khác</label>
                <input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  min={(() => {
                    const d = new Date()
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  })()}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Ngày khám gợi ý">
              {dates.map((date) => (
                <button
                  key={date.value}
                  type="button"
                  onClick={() => {
                    if (selectedDate !== date.value) {
                      setSelectedDate(date.value)
                      setKhungGioDaChon('')
                    }
                  }}
                  aria-pressed={selectedDate === date.value}
                  className={`flex w-24 shrink-0 flex-col items-center justify-center rounded-xl border py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    selectedDate === date.value
                      ? 'border-brand-600 bg-brand-50 font-bold text-brand-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase leading-tight">{date.label.split(',')[0]}</span>
                  <span className="mt-0.5 text-base font-bold leading-normal">{date.label.split(',')[1].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5">
                <div>
                  <h3 className="font-semibold text-slate-900">Khung giờ còn chỗ</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Ngày {selectedDateLabel}</p>
                </div>
              </div>

              {dangTaiKhungCK ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Đang tải khung giờ còn trống...</p>
              ) : !khungTheoChuyenKhoa || khungTheoChuyenKhoa.khung_gio.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Không còn khung giờ trống cho ngày đã chọn. Vui lòng chọn ngày khác.
                </p>
              ) : (
                (['sang', 'chieu', 'toi'] as const).map((ca) => {
                  const dsKhung = khungTheoChuyenKhoa.khung_gio.filter((k) => k.ca === ca)
                  if (dsKhung.length === 0) return null
                  const caLabel = ca === 'sang'
                    ? 'Ca sáng · 08:00 – 11:30'
                    : ca === 'chieu'
                      ? 'Ca chiều · 13:30 – 17:30'
                      : 'Ca tối · 18:00 – 24:00'
                  return (
                    <div key={ca} className="space-y-2 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                      <p className="text-xs font-semibold text-slate-600">
                        {caLabel}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {dsKhung.map((khung) => (
                          <button
                            key={khung.gio_bat_dau}
                            type="button"
                            onClick={() => setKhungGioDaChon(khung.gio_bat_dau)}
                            aria-pressed={khungGioDaChon === khung.gio_bat_dau}
                            className={`min-h-[68px] rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                              khungGioDaChon === khung.gio_bat_dau
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50/40'
                            }`}
                          >
                            <span className="block">{khung.gio_bat_dau}</span>
                            <span className={`mt-0.5 block text-[11px] font-medium ${
                              khungGioDaChon === khung.gio_bat_dau ? 'text-white/80' : 'text-slate-400'
                            }`}>
                              Còn {khung.so_cho_trong} chỗ
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}

              <p className="text-xs leading-5 text-slate-500">
                Đặt lịch trực tuyến vui lòng đến trước giờ hẹn 15 phút!
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-left sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Thông tin người khám</h2>
            <p className="mt-1 text-sm text-slate-600">Thông tin này được sử dụng để xác nhận lịch hẹn và liên hệ khi cần.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-900">Đặt lịch cho</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setBookingFor('self')
                  setPatientName(user?.ho_ten || '')
                  setPatientPhone(user?.so_dien_thoai || '')
                  setSelectedMemberId('')
                  setSymptoms('')
                  setFieldErrors({})
                  setTouchedFields({})
                }}
                aria-pressed={bookingFor === 'self'}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                  bookingFor === 'self'
                    ? 'border-brand-600 bg-brand-50 font-bold text-brand-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-bold">Bản thân</span>
                <span className="mt-1 text-xs text-slate-500">Dùng thông tin tài khoản</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSymptoms('')
                  setFieldErrors({})
                  setTouchedFields({})
                  if (familyMembers.length > 0) {
                    setBookingFor('member')
                    const firstMember = familyMembers[0]
                    setSelectedMemberId(firstMember.id)
                    setPatientName(firstMember.ho_ten)
                    setPatientPhone(firstMember.so_dien_thoai || user?.so_dien_thoai || '')
                  } else {
                    setBookingFor('other')
                    setSelectedMemberId('')
                    setPatientName('')
                    setPatientPhone('')
                  }
                }}
                aria-pressed={bookingFor !== 'self'}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                  bookingFor !== 'self'
                    ? 'border-brand-600 bg-brand-50 font-bold text-brand-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-bold">Đặt hộ</span>
                <span className="mt-1 text-xs text-slate-500">Cho người thân hoặc người khác</span>
              </button>
            </div>
          </div>

          {bookingFor === 'self' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Thông tin của bạn</p>
                <p>
                  <span className="font-semibold text-slate-500">Họ và tên:</span>{' '}
                  <span className="font-bold text-slate-800">{user?.ho_ten}</span>
                </p>
              </div>
              <Input
                label="Số điện thoại liên hệ nhận SMS/Zalo"
                required
                value={patientPhone}
                onChange={(event) => {
                  const val = event.target.value
                  setPatientPhone(val)
                  if (touchedFields.patientPhone) {
                    setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(val) }))
                  }
                }}
                onBlur={() => {
                  setTouchedFields((prev) => ({ ...prev, patientPhone: true }))
                  setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(patientPhone) }))
                }}
                error={touchedFields.patientPhone ? fieldErrors.patientPhone : undefined}
                placeholder="Ví dụ: 0912345678"
              />
            </div>
          )}

          {bookingFor !== 'self' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {familyMembers.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Chọn người khám
                    </label>
                    <span className="text-xs text-slate-500">
                      {familyMembers.length} thành viên gia đình
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {familyMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setBookingFor('member')
                          setSelectedMemberId(member.id)
                          setPatientName(member.ho_ten)
                          const newPhone = member.so_dien_thoai || user?.so_dien_thoai || ''
                          setPatientPhone(newPhone)
                          setSymptoms('')
                          setFieldErrors({})
                          setTouchedFields({})
                        }}
                        aria-pressed={selectedMemberId === member.id}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                          selectedMemberId === member.id
                            ? 'border-brand-600 bg-brand-50 font-bold text-brand-800 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-xs font-bold text-teal-800">
                          {member.ho_ten?.split(' ').pop()?.charAt(0) || 'N'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">{member.ho_ten}</p>
                          <p className="text-[11px] text-slate-500">
                            {member.gioi_tinh === 'nam' ? 'Nam' : member.gioi_tinh === 'nu' ? 'Nữ' : 'Khác'}
                            {member.ngay_sinh && ` • ${new Date(member.ngay_sinh).getFullYear()}`}
                            {member.so_dien_thoai && ` • ${member.so_dien_thoai}`}
                          </p>
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setBookingFor('other')
                        setSelectedMemberId('')
                        setPatientName('')
                        setPatientPhone('')
                        setSymptoms('')
                        setFieldErrors({})
                        setTouchedFields({})
                      }}
                      aria-pressed={!selectedMemberId}
                      className={`flex items-center gap-2.5 rounded-xl border border-dashed p-3 text-left transition ${
                        !selectedMemberId
                          ? 'border-brand-600 bg-brand-50 font-bold text-brand-800 shadow-sm'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                        ➕
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">Người khác</p>
                        <p className="text-xs text-slate-500">Người ngoài gia đình</p>
                      </div>
                    </button>
                  </div>

                  {selectedMemberId ? (
                    <div className="space-y-4 pt-2 border-t border-slate-200/60">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Thông tin người được khám</p>
                        <p>
                          <span className="font-semibold text-slate-500">Họ và tên:</span>{' '}
                          <span className="font-bold text-slate-800">{patientName}</span>
                        </p>
                      </div>
                      <Input
                        label="Số điện thoại liên hệ nhận SMS/Zalo"
                        required
                        value={patientPhone}
                        onChange={(event) => {
                          const val = event.target.value
                          setPatientPhone(val)
                          if (touchedFields.patientPhone) {
                            setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(val) }))
                          }
                        }}
                        onBlur={() => {
                          setTouchedFields((prev) => ({ ...prev, patientPhone: true }))
                          setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(patientPhone) }))
                        }}
                        error={touchedFields.patientPhone ? fieldErrors.patientPhone : undefined}
                        placeholder="Ví dụ: 0912345678"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2 border-t border-slate-200/60">
                      <Input
                        label="Họ và tên người khám"
                        required
                        value={patientName}
                        onChange={(event) => {
                          const val = event.target.value
                          setPatientName(val)
                          if (touchedFields.patientName) {
                            setFieldErrors((prev) => ({ ...prev, patientName: validatePatientName(val) }))
                          }
                        }}
                        onBlur={() => {
                          setTouchedFields((prev) => ({ ...prev, patientName: true }))
                          setFieldErrors((prev) => ({ ...prev, patientName: validatePatientName(patientName) }))
                        }}
                        error={touchedFields.patientName ? fieldErrors.patientName : undefined}
                        placeholder="Nhập họ và tên người khám..."
                      />
                      <Input
                        label="Số điện thoại liên hệ nhận SMS/Zalo"
                        placeholder="Nhập số di động liên hệ..."
                        value={patientPhone}
                        onChange={(event) => {
                          const val = event.target.value
                          setPatientPhone(val)
                          if (touchedFields.patientPhone) {
                            setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(val) }))
                          }
                        }}
                        onBlur={() => {
                          setTouchedFields((prev) => ({ ...prev, patientPhone: true }))
                          setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(patientPhone) }))
                        }}
                        error={touchedFields.patientPhone ? fieldErrors.patientPhone : undefined}
                        required
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Chọn người khám
                    </label>
                    <span className="text-xs text-slate-500">Chưa có hồ sơ gia đình</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    <button
                      type="button"
                      className="flex items-center gap-2.5 rounded-xl border border-brand-600 bg-brand-50 p-3 text-left font-bold text-brand-800 shadow-sm"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-xs font-bold text-teal-800">
                        ➕
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">Người khác</p>
                        <p className="text-xs text-slate-500">Nhập thông tin người cần đặt hộ</p>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-slate-200/60">
                    <Input
                      label="Họ và tên người khám"
                      required
                      value={patientName}
                      onChange={(event) => {
                        const val = event.target.value
                        setPatientName(val)
                        if (touchedFields.patientName) {
                          setFieldErrors((prev) => ({ ...prev, patientName: validatePatientName(val) }))
                        }
                      }}
                      onBlur={() => {
                        setTouchedFields((prev) => ({ ...prev, patientName: true }))
                        setFieldErrors((prev) => ({ ...prev, patientName: validatePatientName(patientName) }))
                      }}
                      error={touchedFields.patientName ? fieldErrors.patientName : undefined}
                      placeholder="Ví dụ: Nguyễn Thị Hoa"
                    />
                    <Input
                      label="Số điện thoại liên hệ nhận SMS/Zalo"
                      required
                      value={patientPhone}
                      onChange={(event) => {
                        const val = event.target.value
                        setPatientPhone(val)
                        if (touchedFields.patientPhone) {
                          setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(val) }))
                        }
                      }}
                      onBlur={() => {
                        setTouchedFields((prev) => ({ ...prev, patientPhone: true }))
                        setFieldErrors((prev) => ({ ...prev, patientPhone: validatePatientPhone(patientPhone) }))
                      }}
                      error={touchedFields.patientPhone ? fieldErrors.patientPhone : undefined}
                      placeholder="Ví dụ: 0912345678"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <Textarea
            label="Mô tả triệu chứng bệnh"
            placeholder="Ví dụ: Đau họng rát buốt khi nuốt, nghẹt mũi kéo dài, đau buốt vùng tai..."
            value={symptoms}
            onChange={(event) => {
              const val = event.target.value
              setSymptoms(val)
              if (touchedFields.symptoms) {
                setFieldErrors((prev) => ({ ...prev, symptoms: validateSymptoms(val) }))
              }
            }}
            onBlur={() => {
              setTouchedFields((prev) => ({ ...prev, symptoms: true }))
              setFieldErrors((prev) => ({ ...prev, symptoms: validateSymptoms(symptoms) }))
            }}
            error={touchedFields.symptoms ? fieldErrors.symptoms : undefined}
            required
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-left sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Xác nhận thông tin đặt lịch</h2>
            <p className="mt-1 text-sm text-slate-600">Vui lòng kiểm tra kỹ trước khi chuyển sang thanh toán.</p>
          </div>

          <div className="grid gap-5 text-sm leading-6 text-slate-700 sm:grid-cols-2">
            <div className="space-y-2 border-b border-slate-100 pb-5 sm:border-b-0 sm:border-r sm:pr-5 sm:pb-0">
              <p><span className="font-semibold text-slate-500">Hình thức:</span> Khám chuyên khoa tại phòng khám</p>
              <p>
                <span className="font-semibold text-slate-500">Bác sĩ phụ trách:</span>{' '}
                <span className="font-medium text-slate-700">Phân công tự động theo suất trống</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Thời gian:</span>{' '}
                <span className="font-semibold text-brand-600">
                  {khungGioDaChon || '--'}
                </span>, ngày {selectedDateLabel}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Phí khám:</span>{' '}
                <span className="font-bold text-slate-800">
                  {formatCurrency(
                    khungTheoChuyenKhoa?.gia_kham ?? 0,
                  )}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Người khám:</span> <span className="font-bold text-slate-800">{patientName}</span></p>
              <p><span className="font-semibold text-slate-500">Điện thoại:</span> {patientPhone}</p>
              <p><span className="font-semibold text-slate-500">Triệu chứng:</span> {symptoms}</p>
            </div>
          </div>

          <DieuKhoanDatLich
            daDongY={dongYDieuKhoan}
            onChange={setDongYDieuKhoan}
            giaKham={khungTheoChuyenKhoa?.gia_kham ?? null}
          />

          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            Sau khi xác nhận, hệ thống tạo lịch hẹn ở trạng thái chờ thanh toán và hiển thị mã QR để bạn tiếp tục.
          </div>
        </div>
      )}

      {step === 5 && createdBooking && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-left sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-700">Thanh toán VNPAY</p>
            <h2 className="text-xl font-bold text-slate-900">Thanh toán qua mã QR</h2>
            <p className="text-sm leading-6 text-slate-600">
              Hệ thống đã tạo lịch hẹn. Vui lòng quét mã QR VNPAY để hoàn tất thanh toán.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-500">Mã lịch hẹn:</span> {createdBooking.appointment_id}</p>
              <p><span className="font-semibold text-slate-500">Mã giao dịch:</span> {createdBooking.ma_giao_dich}</p>
              <p><span className="font-semibold text-slate-500">Số hóa đơn:</span> {createdBooking.so_hoa_don}</p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-500">Trạng thái lịch:</span> {paymentSnapshot?.appointment_status || createdBooking.status}</p>
              <p><span className="font-semibold text-slate-500">Trạng thái thanh toán:</span> {paymentSnapshot?.appointment_payment_status || createdBooking.payment_status}</p>
              <p><span className="font-semibold text-slate-500">Số tiền:</span> <span className="font-bold text-slate-800">{formatCurrency(createdBooking.gia_kham)}</span></p>
            </div>
          </div>

          {paymentSnapshot?.appointment_info && (
            <div className="grid gap-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 sm:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-700">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Thông tin ca khám</p>
                <p><span className="font-semibold text-slate-500">Bác sĩ:</span> {paymentSnapshot.appointment_info.doctor?.ho_ten || 'Đang phân công'}</p>
                <p><span className="font-semibold text-slate-500">Chuyên khoa:</span> {paymentSnapshot.appointment_info.specialty?.ten || 'Đang cập nhật'}</p>
                <p><span className="font-semibold text-slate-500">Thời gian:</span> {paymentSnapshot.appointment_info.gio_kham || '--'} · {paymentSnapshot.appointment_info.ngay_kham ? new Date(paymentSnapshot.appointment_info.ngay_kham).toLocaleDateString('vi-VN') : '--'}</p>
                <p><span className="font-semibold text-slate-500">Phòng:</span> {paymentSnapshot.appointment_info.phong_kham || 'Sẽ được điều phối'}</p>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Thông tin bệnh nhân</p>
                <p><span className="font-semibold text-slate-500">Họ tên:</span> {paymentSnapshot.appointment_info.patient.ho_ten || patientName}</p>
                <p><span className="font-semibold text-slate-500">Số điện thoại:</span> {paymentSnapshot.appointment_info.patient.so_dien_thoai || patientPhone}</p>
                {paymentSnapshot.appointment_info.patient.nam_sinh && <p><span className="font-semibold text-slate-500">Năm sinh:</span> {paymentSnapshot.appointment_info.patient.nam_sinh}</p>}
              </div>
            </div>
          )}

          {creatingPaymentSession && !paymentSnapshot ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Đang tạo session VNPAY và mã QR thanh toán...
            </div>
          ) : paymentSnapshot ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Mã tham chiếu VNPAY</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{paymentSnapshot.gateway.vnp_txn_ref || '--'}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    paymentSnapshot.gateway.is_expired ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {countdownLabel || 'Sẵn sàng'}
                  </div>
                </div>

                <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="Mã QR VNPAY mock" className="aspect-square w-full max-w-[288px] rounded-xl bg-white p-3 shadow-sm" />
                  ) : (
                    <div className="grid aspect-square w-full max-w-[288px] place-items-center rounded-xl bg-white text-sm text-slate-400 shadow-sm">
                      Đang render mã QR...
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-700">Hướng dẫn thanh toán</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Mở ứng dụng ngân hàng có hỗ trợ quét QR.</li>
                    <li>Quét mã QR bên trên hoặc bấm mở trang VNPAY để thanh toán.</li>
                    <li>Hệ thống sẽ tự động chuyển hướng khi thanh toán thành công.</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
                <div className="space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-500">Nhà cung cấp:</span> {paymentSnapshot.gateway.provider || 'vnpay'}</p>
                  <p><span className="font-semibold text-slate-500">Mode:</span> {paymentSnapshot.gateway.mode || 'mock'}</p>
                  <p><span className="font-semibold text-slate-500">Merchant:</span> {paymentSnapshot.gateway.merchant_name || 'ViteFamily'}</p>
                  <p><span className="font-semibold text-slate-500">Mã merchant:</span> {paymentSnapshot.gateway.merchant_code || 'VITEFAMILY'}</p>
                  <p><span className="font-semibold text-slate-500">Ngân hàng:</span> {paymentSnapshot.gateway.bank_code || 'VNBANK'}</p>
                  <p><span className="font-semibold text-slate-500">Hạn thanh toán:</span> {formatGatewayExpiry(paymentSnapshot.gateway.expires_at)}</p>
                  <p><span className="font-semibold text-slate-500">Trạng thái gateway:</span> {paymentSnapshot.gateway.mock_status || 'waiting_for_customer'}</p>
                </div>

                {paymentSnapshot.gateway.is_expired ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Mã QR này đã hết hạn. Lịch hẹn vẫn còn ở trạng thái pending/unpaid, bạn có thể tạo lại mã mới để tiếp tục thanh toán.
                  </div>
                ) : (
                  <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    Mã QR thanh toán VNPay hợp lệ. Vui lòng không đóng trình duyệt trong quá trình thanh toán.
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button variant="secondary" onClick={handleOpenVnpayPage} disabled={!paymentSnapshot.gateway.payment_url}>
                    Mở trang VNPAY
                  </Button>
                  <Button variant="danger" onClick={handleCancelPayment} loading={cancellingPayment}>
                    Hủy thanh toán và trả lại khung giờ
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
              Không tải được session VNPAY mock cho lịch hẹn này.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        {step > 2 && step < 5 ? (
          <Button variant="secondary" onClick={handlePrevStep}>
            Quay lại
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button onClick={handleNextStep}>Tiếp tục</Button>
        ) : step === 4 ? (
          <Button onClick={handleCreateBooking} loading={submittingBooking} disabled={!dongYDieuKhoan}>
            Xác nhận đặt lịch khám
          </Button>
        ) : null}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
