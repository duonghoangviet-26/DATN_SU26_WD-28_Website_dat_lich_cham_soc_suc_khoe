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
  type PatientBookingDoctor,
  type PatientBookingSlot,
  type PatientPaymentStatusResult,
  type FamilyMember,
  type CreateBookingPayload,
} from '@/services/patient-booking.service'

type BookingStep = 1 | 2 | 3 | 4 | 5

function formatSlotLabel(slot: PatientBookingSlot) {
  return `${slot.gio_bat_dau} - ${slot.gio_ket_thuc}`
}

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

  const queryDoctorId = searchParams.get('doctor_id')

  const [step, setStep] = useState<BookingStep>(1)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  // Booking target states
  const [bookingFor, setBookingFor] = useState<'self' | 'member' | 'other'>('self')
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')

  const [patientName, setPatientName] = useState(user?.ho_ten || '')
  const [patientPhone, setPatientPhone] = useState(user?.so_dien_thoai || '')
  const [symptoms, setSymptoms] = useState('')

  const [toast, setToast] = useState<string | null>(null)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [creatingPaymentSession, setCreatingPaymentSession] = useState(false)
  const [completingMockPayment, setCompletingMockPayment] = useState(false)

  const [dates, setDates] = useState<{ value: string; label: string }[]>([])
  const [doctors, setDoctors] = useState<PatientBookingDoctor[]>([])
  const [doctorSearch, setDoctorSearch] = useState('')
  const [slots, setSlots] = useState<PatientBookingSlot[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [createdBooking, setCreatedBooking] = useState<CreatedBookingResult | null>(null)
  const [paymentSnapshot, setPaymentSnapshot] = useState<PatientPaymentStatusResult | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const datesList = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(today)
      nextDate.setDate(today.getDate() + i)
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
      setSelectedDate(datesList[0].value)
    }
  }, [])

  const filteredDoctors = doctors.filter((doc) => {
    const matchesName = doc.ho_ten.toLowerCase().includes(doctorSearch.toLowerCase())
    const matchesSpecialty = doc.specialties.some((s) => s.ten.toLowerCase().includes(doctorSearch.toLowerCase()))
    return matchesName || matchesSpecialty
  })

  useEffect(() => {
    if (user) {
      setPatientName(user.ho_ten)
      setPatientPhone(user.so_dien_thoai || '')

      let ignore = false
      patientBookingService.getFamilyGroup()
        .then((group) => {
          if (!ignore && group) {
            setFamilyMembers(group.members || [])
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
    setLoadingDoctors(true)
    patientBookingService.getDoctors()
      .then((data) => {
        if (ignore) return
        setDoctors(data)
        if (queryDoctorId && data.some((doctor) => doctor.id === queryDoctorId)) {
          setSelectedDoctorId(queryDoctorId)
        }
      })
      .catch((error: any) => {
        if (!ignore) {
          setToast(error.response?.data?.message || error.message || 'Không tải được danh sách bác sĩ')
        }
      })
      .finally(() => {
        if (!ignore) setLoadingDoctors(false)
      })

    return () => {
      ignore = true
    }
  }, [queryDoctorId])

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setSlots([])
      return
    }

    let ignore = false
    setLoadingSlots(true)
    setSelectedSlotId('')
    patientBookingService.getSlots(selectedDoctorId, selectedDate)
      .then((data) => {
        if (!ignore) setSlots(data)
      })
      .catch((error: any) => {
        if (!ignore) {
          setSlots([])
          setToast(error.response?.data?.message || error.message || 'Không tải được slot khám')
        }
      })
      .finally(() => {
        if (!ignore) setLoadingSlots(false)
      })

    return () => {
      ignore = true
    }
  }, [selectedDoctorId, selectedDate])

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
      navigate(`/profile?booked=true&id=${createdBooking?.id || createdBooking?.appointment_id || ''}`, { replace: true })
    }
  }, [step, paymentSnapshot?.payment_status, paymentSnapshot?.appointment_status, createdBooking, navigate])

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) || null
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) || null
  const countdownLabel = getCountdownLabel(paymentSnapshot?.gateway.expires_at || null, nowMs)

  function handleNextStep() {
    if (step === 1) {
      if (!selectedDoctorId) {
        setToast('Vui lòng chọn bác sĩ khám chuyên khoa.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      if (!selectedDate || !selectedSlotId) {
        setToast('Vui lòng chọn ngày khám và khung giờ còn trống.')
        return
      }
      setStep(3)
      return
    }

    if (step === 3) {
      if (bookingFor === 'member' && !selectedMemberId) {
        setToast('Vui lòng chọn một thành viên trong gia đình.')
        return
      }

      const nameTrimmed = patientName.trim()
      const phoneTrimmed = patientPhone.trim()

      if (!nameTrimmed || !phoneTrimmed) {
        setToast('Họ tên và số điện thoại liên hệ là bắt buộc.')
        return
      }

      // Kiểm tra định dạng Họ tên (chữ cái Tiếng Việt có dấu, khoảng trắng)
      const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠƯưăâêôơưẠ-ỹđĐ\s']{2,100}$/
      if (!nameRegex.test(nameTrimmed)) {
        setToast('Họ tên bệnh nhân không hợp lệ (phải từ 2 ký tự trở lên và chỉ chứa chữ cái).')
        return
      }

      // Kiểm tra định dạng Số điện thoại (10 chữ số, bắt đầu bằng 0)
      const phoneRegex = /^0\d{9}$/
      if (!phoneRegex.test(phoneTrimmed)) {
        setToast('Số điện thoại liên hệ không hợp lệ (phải gồm 10 chữ số và bắt đầu bằng số 0).')
        return
      }

      if (!symptoms.trim()) {
        setToast('Vui lòng mô tả sơ qua triệu chứng bệnh.')
        return
      }

      if (symptoms.trim().length < 5) {
        setToast('Mô tả triệu chứng quá ngắn (vui lòng nhập tối thiểu 5 ký tự để bác sĩ nắm thông tin).')
        return
      }

      setStep(4)
    }
  }

  function handlePrevStep() {
    if (step === 5) {
      return
    }
    if (step > 1) {
      setStep((prev) => (prev - 1) as BookingStep)
    }
  }

  async function handleCreateBooking() {
    if (!selectedDoctor || !selectedSlot) {
      setToast('Thiếu thông tin bác sĩ hoặc khung giờ khám.')
      return
    }

    setSubmittingBooking(true)
    try {
      const payload: CreateBookingPayload = {
        loai_kham: 'clinic',
        doctor_id: selectedDoctor.id,
        schedule_id: selectedSlot.schedule_id,
        slot_id: selectedSlot.id,
        ngay_kham: selectedDate,
        ly_do_kham: symptoms.trim(),
        ten_khach: patientName.trim(),
        so_dien_thoai_khach: patientPhone.trim(),
        phuong_thuc: 'chuyen_khoan',
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

  async function handleRefreshVnpaySession() {
    if (!createdBooking?.payment_id) return

    setCreatingPaymentSession(true)
    try {
      const refreshed = await patientBookingService.createVnpaySession(createdBooking.payment_id)
      setPaymentSnapshot(refreshed)
      setToast('Đã tạo lại mã QR VNPAY mới.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Không tạo lại được mã QR VNPAY')
    } finally {
      setCreatingPaymentSession(false)
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
    setSelectedDate(dateValue)
  }

  async function handleMockCompletePayment() {
    if (!createdBooking?.payment_id) return

    setCompletingMockPayment(true)
    try {
      const updated = await patientBookingService.completeMockVnpayPayment(createdBooking.payment_id)
      setPaymentSnapshot(updated)
      setToast('Đã mô phỏng thanh toán thành công. Đang chuyển về hồ sơ của bạn...')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Xác nhận thanh toán VNPAY mock thất bại')
    } finally {
      setCompletingMockPayment(false)
    }
  }

  if (authLoading || loadingDoctors) {
    return <Loading message="Đang tải dữ liệu đặt lịch..." />
  }

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16">
      <Breadcrumb items={[{ label: 'Đặt lịch khám' }]} />

      <div className="space-y-2 text-left">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Đặt Lịch Khám Tai Mũi Họng</h1>
        <p className="text-sm text-slate-500">
          Đăng ký lịch khám trực tiếp với bác sĩ chuyên khoa và thanh toán qua màn QR VNPAY mô phỏng của hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 border-b border-slate-200 pb-6 text-center">
        {[
          { num: 1, label: 'Chọn Bác sĩ' },
          { num: 2, label: 'Thời gian' },
          { num: 3, label: 'Triệu chứng' },
          { num: 4, label: 'Xác nhận lịch' },
          { num: 5, label: 'Thanh toán' },
        ].map((item) => (
          <div key={item.num} className="space-y-2">
            <div
              className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${
                step >= item.num ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {item.num}
            </div>
            <p className={`hidden text-xs font-semibold sm:block ${step >= item.num ? 'text-slate-800' : 'text-slate-400'}`}>
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn bác sĩ phụ trách</label>
              
              {/* Ô tìm kiếm bác sĩ */}
              {doctors.length > 0 && (
                <div className="relative w-full sm:w-72">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo tên bác sĩ"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-1.5 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
                  />
                </div>
              )}
            </div>

            {doctors.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Hiện chưa có bác sĩ khả dụng để đặt lịch.</p>
            ) : filteredDoctors.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-xs text-slate-400 text-center">Không tìm thấy bác sĩ phù hợp với từ khóa tìm kiếm.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredDoctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    type="button"
                    onClick={() => setSelectedDoctorId(doctor.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      selectedDoctorId === doctor.id
                        ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {doctor.anh_dai_dien ? (
                        <img src={doctor.anh_dai_dien} alt={doctor.ho_ten} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-brand-100 text-lg font-extrabold text-brand-600">
                          {doctor.ho_ten.split(' ').pop()?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-snug text-slate-800">{doctor.ho_ten}</h4>
                      <p className="mt-0.5 text-[10px] font-medium uppercase text-slate-400">
                        {doctor.specialties.map((specialty) => specialty.ten).join(', ')}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-brand-600">
                        {formatCurrency(doctor.gia_kham)} • {doctor.so_nam_kinh_nghiem} năm kinh nghiệm
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn ngày khám</label>
              
              {/* Chọn ngày từ lịch */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Hoặc chọn ngày khác:</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={(() => {
                    const d = new Date()
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  })()}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((date) => (
                <button
                  key={date.value}
                  type="button"
                  onClick={() => setSelectedDate(date.value)}
                  className={`flex w-24 shrink-0 flex-col items-center justify-center rounded-xl border py-2.5 text-center transition-all ${
                    selectedDate === date.value
                      ? 'border-brand-500 bg-brand-50/20 font-bold text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase leading-tight">{date.label.split(',')[0]}</span>
                  <span className="mt-0.5 text-base font-bold leading-normal">{date.label.split(',')[1].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn khung giờ khám</label>
            {loadingSlots ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Đang tải khung giờ còn trống...</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Không có slot trống cho ngày đã chọn.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                      selectedSlotId === slot.id
                        ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {slot.gio_bat_dau}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <h3 className="border-b border-slate-50 pb-2 text-sm font-bold text-slate-800">Thông tin người khám bệnh</h3>

          {/* Chọn đối tượng khám */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Đối tượng khám bệnh</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setBookingFor('self')
                  setPatientName(user?.ho_ten || '')
                  setPatientPhone(user?.so_dien_thoai || '')
                  setSelectedMemberId('')
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                  bookingFor === 'self'
                    ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">🙋‍♂️ Tự khám</span>
                <span className="mt-1 text-[10px] font-normal text-slate-400">Đặt lịch cho bản thân</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingFor('member')
                  if (familyMembers.length > 0) {
                    const firstMember = familyMembers[0]
                    setSelectedMemberId(firstMember.id)
                    setPatientName(firstMember.ho_ten)
                  } else {
                    setSelectedMemberId('')
                    setPatientName('')
                  }
                  setPatientPhone(user?.so_dien_thoai || '')
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                  bookingFor === 'member'
                    ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">👨‍👩‍👧 Đặt hộ gia đình</span>
                <span className="mt-1 text-[10px] font-normal text-slate-400">Chọn thành viên đã lưu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingFor('other')
                  setPatientName('')
                  setPatientPhone('')
                  setSelectedMemberId('')
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                  bookingFor === 'other'
                    ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold">👥 Đặt hộ người khác</span>
                <span className="mt-1 text-[10px] font-normal text-slate-400">Nhập thủ công thông tin</span>
              </button>
            </div>
          </div>

          {/* Hiển thị chi tiết theo đối tượng */}
          {bookingFor === 'self' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Thông tin của bạn</p>
                <div className="text-sm">
                  <p><span className="font-semibold text-slate-500">Họ và tên:</span> <span className="font-bold text-slate-800">{user?.ho_ten}</span></p>
                </div>
              </div>
              <Input
                label="Số điện thoại liên hệ nhận SMS/Zalo"
                placeholder="Nhập số di động liên hệ..."
                value={patientPhone}
                onChange={(event) => setPatientPhone(event.target.value)}
                required
              />
            </div>
          )}

          {bookingFor === 'member' && (
            <div className="space-y-4">
              {familyMembers.length === 0 ? (
                <div className="rounded-xl bg-amber-50 p-4 border border-amber-100 text-sm text-amber-800 space-y-2">
                  <p className="font-bold">⚠️ Chưa có thành viên gia đình</p>
                  <p className="text-xs">Bạn chưa thêm thành viên nào vào nhóm gia đình. Vui lòng truy cập trang **Hồ sơ bệnh nhân** để thiết lập nhóm và thêm thành viên trước, hoặc chọn hình thức "Đặt hộ người khác" để nhập thủ công.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn thành viên gia đình</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {familyMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(member.id)
                          setPatientName(member.ho_ten)
                        }}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          selectedMemberId === member.id
                            ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                            : 'border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        <h4 className="text-xs font-bold leading-snug">{member.ho_ten}</h4>
                        <p className="mt-1 text-[10px] text-slate-400 uppercase">
                          {member.gioi_tinh === 'nam' ? 'Nam' : member.gioi_tinh === 'nu' ? 'Nữ' : 'Khác'} • {new Date(member.ngay_sinh).getFullYear()}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Họ và tên bệnh nhân (Tự động điền)"
                      value={patientName}
                      disabled
                      required
                    />
                    <Input
                      label="Số điện thoại liên hệ nhận SMS/Zalo"
                      placeholder="Nhập số di động liên hệ..."
                      value={patientPhone}
                      onChange={(event) => setPatientPhone(event.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {bookingFor === 'other' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Họ và tên bệnh nhân"
                placeholder="Nhập họ tên đầy đủ..."
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                required
              />
              <Input
                label="Số điện thoại liên hệ"
                placeholder="Nhập số di động..."
                value={patientPhone}
                onChange={(event) => setPatientPhone(event.target.value)}
                required
              />
            </div>
          )}

          <Textarea
            label="Mô tả triệu chứng bệnh"
            placeholder="Ví dụ: Đau họng rát buốt khi nuốt, nghẹt mũi kéo dài, đau buốt vùng tai..."
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            required
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <h3 className="border-b border-slate-50 pb-2 text-sm font-bold text-slate-800">Tóm tắt lịch hẹn khám</h3>

          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Hình thức:</span> Khám chuyên khoa tại phòng khám</p>
              <p><span className="font-semibold text-slate-500">Bác sĩ phụ trách:</span> <span className="font-bold text-slate-800">{selectedDoctor?.ho_ten}</span></p>
              <p><span className="font-semibold text-slate-500">Thời gian:</span> <span className="font-semibold text-brand-600">{selectedSlot ? formatSlotLabel(selectedSlot) : '--'}</span>, ngày {selectedDate}</p>
            </div>

            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Người khám:</span> <span className="font-bold text-slate-800">{patientName}</span></p>
              <p><span className="font-semibold text-slate-500">Điện thoại:</span> {patientPhone}</p>
              <p><span className="font-semibold text-slate-500">Triệu chứng:</span> {symptoms}</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
            * Sau khi bấm xác nhận, hệ thống sẽ tạo lịch hẹn thật ở trạng thái <strong>pending/unpaid</strong> rồi sinh mã QR VNPAY mock để bạn tiếp tục thanh toán.
          </div>
        </div>
      )}

      {step === 5 && createdBooking && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">VNPAY Mock QR</p>
            <h3 className="text-xl font-extrabold text-slate-800">Thanh toán qua mã QR</h3>
            <p className="text-sm text-slate-500">
              Hệ thống đã tạo lịch hẹn và giao dịch thật trong MongoDB. Bước này mô phỏng đúng luồng quét QR VNPAY trước khi backend xác nhận giao dịch.
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
                    <img src={qrCodeDataUrl} alt="Mã QR VNPAY mock" className="h-72 w-72 rounded-xl bg-white p-3 shadow-sm" />
                  ) : (
                    <div className="grid h-72 w-72 place-items-center rounded-xl bg-white text-sm text-slate-400 shadow-sm">
                      Đang render mã QR...
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-700">Cách test luồng này</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Mở ứng dụng ngân hàng hoặc ví có hỗ trợ quét QR.</li>
                    <li>Quét mã QR mô phỏng hoặc bấm mở trang VNPAY để xem session.</li>
                    <li>Sau đó bấm nút mô phỏng thanh toán thành công để backend nhận callback giả lập.</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
                <div className="space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-500">Nhà cung cấp:</span> {paymentSnapshot.gateway.provider || 'vnpay'}</p>
                  <p><span className="font-semibold text-slate-500">Mode:</span> {paymentSnapshot.gateway.mode || 'mock'}</p>
                  <p><span className="font-semibold text-slate-500">Merchant:</span> {paymentSnapshot.gateway.merchant_name || 'VitaFamily'}</p>
                  <p><span className="font-semibold text-slate-500">Mã merchant:</span> {paymentSnapshot.gateway.merchant_code || 'VITAFAMILY'}</p>
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
                    QR này được tạo theo session VNPAY mock. Backend chỉ chuyển lịch sang confirmed khi nhận thao tác mô phỏng callback thành công.
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button variant="secondary" onClick={handleOpenVnpayPage} disabled={!paymentSnapshot.gateway.payment_url}>
                    Mở trang VNPAY
                  </Button>
                  <Button variant="secondary" onClick={handleRefreshVnpaySession} loading={creatingPaymentSession}>
                    Tạo lại mã QR
                  </Button>
                  <Button
                    onClick={handleMockCompletePayment}
                    loading={completingMockPayment}
                    disabled={paymentSnapshot.gateway.is_expired || paymentSnapshot.payment_status !== 'pending'}
                  >
                    Mô phỏng thanh toán thành công
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/profile', { replace: true })}>
                    Thanh toán sau
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
        {step > 1 && step < 5 ? (
          <Button variant="secondary" onClick={handlePrevStep}>
            Quay lại
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button onClick={handleNextStep}>Tiếp tục</Button>
        ) : step === 4 ? (
          <Button onClick={handleCreateBooking} loading={submittingBooking}>
            Xác nhận đặt lịch khám
          </Button>
        ) : null}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
