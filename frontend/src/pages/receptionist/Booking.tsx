import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'

import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Loading from '@/components/common/Loading'
import Textarea from '@/components/common/Textarea'
import Toast from '@/components/common/Toast'
import {
  receptionistBookingService,
  type CreatedReceptionistBookingResult,
  type ReceptionistBookingDoctor,
  type ReceptionistBookingSlot,
  type ReceptionistPaymentStatusResult,
} from '@/services/receptionist-booking.service'

type BookingStep = 1 | 2 | 3 | 4 | 5

function formatSlotLabel(slot: ReceptionistBookingSlot) {
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

export default function ReceptionistBooking() {
  const navigate = useNavigate()

  const [step, setStep] = useState<BookingStep>(1)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')

  const [toast, setToast] = useState<string | null>(null)
  const [submittingBooking, setSubmittingBooking] = useState(false)

  const [foundUser, setFoundUser] = useState<any | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const [dates, setDates] = useState<{ value: string; label: string }[]>([])
  const [doctors, setDoctors] = useState<ReceptionistBookingDoctor[]>([])
  const [slots, setSlots] = useState<ReceptionistBookingSlot[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  const [createdBooking, setCreatedBooking] = useState<CreatedReceptionistBookingResult | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

  const [creatingPaymentSession, setCreatingPaymentSession] = useState(false)
  const [paymentSnapshot, setPaymentSnapshot] = useState<ReceptionistPaymentStatusResult | null>(null)
  const [completingMockPayment, setCompletingMockPayment] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const datesList = []
    const today = new Date()
    for (let i = 0; i <= 7; i++) {
      const nextDate = new Date(today)
      nextDate.setDate(today.getDate() + i)
      const yyyy = nextDate.getFullYear()
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0')
      const dd = String(nextDate.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const weekday = nextDate.toLocaleDateString('vi-VN', { weekday: 'short' })
      const day = nextDate.getDate()
      const month = nextDate.getMonth() + 1
      const label = i === 0 ? `Hôm nay, ${day}/${month}` : `${weekday}, ${day}/${month}`
      datesList.push({ value: dateStr, label })
    }
    setDates(datesList)
    if (datesList.length > 0) {
      setSelectedDate(datesList[0].value)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    setLoadingDoctors(true)
    receptionistBookingService.getDoctors()
      .then((data) => {
        if (!ignore) setDoctors(data)
      })
      .catch((error: any) => {
        if (!ignore) {
          setToast(error.response?.data?.message || error.message || 'Không tải được danh sách bác sĩ')
        }
      })
      .finally(() => {
        if (!ignore) setLoadingDoctors(false)
      })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (patientPhone.length === 10) {
      const timer = setTimeout(async () => {
        setIsLookingUp(true)
        try {
          const data = await receptionistBookingService.lookupUserByPhone(patientPhone)
          if (data.found && data.user) {
            setFoundUser(data.user)
            setPatientName(data.user.ho_ten)
            setToast('Đã tìm thấy thông tin khách hàng cũ!')
          } else {
            setFoundUser(null)
          }
        } catch (error) {
          console.error('Lỗi tra cứu user:', error)
        } finally {
          setIsLookingUp(false)
        }
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setFoundUser(null)
    }
  }, [patientPhone])

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setSlots([])
      return
    }
    let ignore = false
    setLoadingSlots(true)
    setSelectedSlotId('')
    receptionistBookingService.getSlots(selectedDoctorId, selectedDate)
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
    return () => { ignore = true }
  }, [selectedDoctorId, selectedDate])

  useEffect(() => {
    if (step !== 5 || !createdBooking?.payment_id || paymentMethod !== 'transfer') return

    let cancelled = false
    setCreatingPaymentSession(true)
    receptionistBookingService.createVnpaySession(createdBooking.payment_id)
      .then((data) => {
        if (!cancelled) setPaymentSnapshot(data)
      })
      .catch((error: any) => {
        if (!cancelled) setToast(error.response?.data?.message || 'Không tạo được session VNPAY mock')
      })
      .finally(() => {
        if (!cancelled) setCreatingPaymentSession(false)
      })

    return () => {
      cancelled = true
    }
  }, [step, createdBooking?.payment_id, paymentMethod])

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
    if (step !== 5 || !createdBooking?.payment_id || paymentSnapshot?.payment_status !== 'pending' || paymentMethod !== 'transfer') return

    let cancelled = false
    const intervalId = window.setInterval(() => {
      receptionistBookingService.getPaymentStatus(createdBooking.payment_id)
        .then((data) => {
          if (!cancelled) setPaymentSnapshot(data)
        })
        .catch(() => {})
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [step, createdBooking?.payment_id, paymentSnapshot?.payment_status, paymentMethod])

  useEffect(() => {
    if (step !== 5 || paymentSnapshot?.payment_status !== 'pending' || paymentSnapshot.gateway.is_expired) return

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [step, paymentSnapshot?.payment_status, paymentSnapshot?.gateway.is_expired])

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
      if (!patientName.trim() || !patientPhone.trim()) {
        setToast('Họ tên và số điện thoại liên hệ là bắt buộc.')
        return
      }
      if (!/^\d{10}$/.test(patientPhone.trim())) {
        setToast('Số điện thoại phải bao gồm đúng 10 chữ số.')
        return
      }
      setStep(4)
    }
  }

  function handlePrevStep() {
    if (step === 5) return
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
      const payload = {
        doctor_id: selectedDoctor.id,
        schedule_id: selectedSlot.schedule_id,
        slot_id: selectedSlot.id,
        ngay_kham: selectedDate,
        ten_khach: patientName.trim(),
        so_dien_thoai_khach: patientPhone.trim(),
        ly_do_kham: symptoms.trim(),
        payment_method: paymentMethod,
        user_id: foundUser?._id,
      }
      const created = await receptionistBookingService.createBooking(payload)
      setCreatedBooking(created)
      setStep(5)
      setToast('Tạo lịch hẹn thành công.')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Tạo lịch hẹn thất bại')
    } finally {
      setSubmittingBooking(false)
    }
  }

  function handleReset() {
    setStep(1)
    setSelectedDoctorId('')
    setSelectedSlotId('')
    setPatientName('')
    setPatientPhone('')
    setSymptoms('')
    setPaymentMethod('cash')
    setCreatedBooking(null)
    setQrCodeDataUrl('')
    setPaymentSnapshot(null)
    setCreatingPaymentSession(false)
  }

  async function handleRefreshVnpaySession() {
    if (!createdBooking?.payment_id) return
    setCreatingPaymentSession(true)
    try {
      const data = await receptionistBookingService.createVnpaySession(createdBooking.payment_id)
      setPaymentSnapshot(data)
      setToast('Đã tạo lại session VNPAY mock')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Lỗi khi tạo lại session')
    } finally {
      setCreatingPaymentSession(false)
    }
  }

  function handleOpenVnpayPage() {
    if (paymentSnapshot?.gateway.payment_url) {
      window.open(paymentSnapshot.gateway.payment_url, '_blank')
    }
  }

  async function handleMockCompletePayment() {
    if (!createdBooking?.payment_id) return
    setCompletingMockPayment(true)
    try {
      const data = await receptionistBookingService.completeMockVnpayPayment(createdBooking.payment_id)
      setPaymentSnapshot(data)
      setToast('Đã mô phỏng thanh toán thành công!')
    } catch (error: any) {
      setToast(error.response?.data?.message || error.message || 'Lỗi khi mô phỏng thanh toán')
    } finally {
      setCompletingMockPayment(false)
    }
  }

  if (loadingDoctors) {
    return <Loading message="Đang tải dữ liệu đặt lịch..." />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16">

      <div className="space-y-2 text-left">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Lễ tân: Đặt Lịch Khám</h1>
        <p className="text-sm text-slate-500">
          Tạo lịch khám cho khách hàng trực tiếp hoặc qua điện thoại.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 border-b border-slate-200 pb-6 text-center">
        {[
          { num: 1, label: 'Chọn Bác sĩ' },
          { num: 2, label: 'Thời gian' },
          { num: 3, label: 'Thông tin' },
          { num: 4, label: 'Thanh toán' },
          { num: 5, label: 'Hoàn tất' },
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
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn bác sĩ phụ trách</label>
            {doctors.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Hiện chưa có bác sĩ khả dụng để đặt lịch.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {doctors.map((doctor) => (
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
                        {formatCurrency(doctor.gia_kham)}
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
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Chọn ngày khám</label>
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
                  <span className="mt-0.5 text-base font-bold leading-normal">{date.label.split(',')[1]?.trim() || date.label}</span>
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
          <h3 className="border-b border-slate-50 pb-2 text-sm font-bold text-slate-800">Thông tin khách hàng</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên khách hàng"
              placeholder="Nhập họ tên đầy đủ..."
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              disabled={!!foundUser}
              required
            />
            <div className="space-y-1">
              <Input
                label="Số điện thoại liên hệ"
                placeholder="Nhập số di động..."
                value={patientPhone}
                onChange={(event) => setPatientPhone(event.target.value.replace(/\D/g, ''))}
                maxLength={10}
                required
              />
              {isLookingUp && <p className="text-xs text-brand-600 animate-pulse">Đang tra cứu số điện thoại...</p>}
              {foundUser && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Khách hàng đã đăng ký (Đã từng đặt {foundUser.so_lan_dat_lich} lịch)
                </p>
              )}
            </div>
          </div>

          <Textarea
            label="Ghi chú / Triệu chứng (Không bắt buộc)"
            placeholder="Ghi chú thêm về triệu chứng khách hàng cung cấp..."
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
          <h3 className="border-b border-slate-50 pb-2 text-sm font-bold text-slate-800">Tóm tắt lịch hẹn khám & Thanh toán</h3>

          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Bác sĩ phụ trách:</span> <span className="font-bold text-slate-800">{selectedDoctor?.ho_ten}</span></p>
              <p><span className="font-semibold text-slate-500">Thời gian:</span> <span className="font-semibold text-brand-600">{selectedSlot ? formatSlotLabel(selectedSlot) : '--'}</span>, ngày {selectedDate}</p>
              <p><span className="font-semibold text-slate-500">Phí khám:</span> <span className="font-bold text-red-600">{formatCurrency(selectedDoctor?.gia_kham || 0)}</span></p>
            </div>

            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Người khám:</span> <span className="font-bold text-slate-800">{patientName}</span></p>
              <p><span className="font-semibold text-slate-500">Điện thoại:</span> {patientPhone}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Hình thức thanh toán</label>
            <div className="flex gap-4">
              <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                paymentMethod === 'cash' ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  className="h-4 w-4 text-brand-600"
                />
                <span className="font-semibold text-slate-700">Thu Tiền Mặt</span>
              </label>

              <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                paymentMethod === 'transfer' ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="transfer"
                  checked={paymentMethod === 'transfer'}
                  onChange={() => setPaymentMethod('transfer')}
                  className="h-4 w-4 text-brand-600"
                />
                <span className="font-semibold text-slate-700">Khách Chuyển Khoản</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {step === 5 && createdBooking && (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          {paymentMethod === 'cash' ? (
            <div className="space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                ✓
              </div>
              <h3 className="text-xl font-extrabold text-slate-800">Đặt lịch thành công!</h3>
              <p className="text-sm text-slate-500">
                Đã thu tiền mặt. Lịch hẹn được xác nhận (Confirmed) thành công.
              </p>
              <div className="pt-4">
                <Button onClick={handleReset}>Tạo lịch hẹn khác</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-left">
              <div className="space-y-2 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-600">VNPAY Mock QR</p>
                <h3 className="text-xl font-extrabold text-slate-800">Thanh toán qua mã QR</h3>
                <p className="text-sm text-slate-500">
                  Hệ thống đã tạo lịch hẹn và giao dịch thật trong MongoDB. Bước này mô phỏng luồng quét QR VNPAY cho Lễ tân.
                </p>
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:grid-cols-2">
                <div className="space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-500">Mã lịch hẹn:</span> {createdBooking.appointment_id}</p>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-500">Trạng thái thanh toán:</span> {paymentSnapshot?.payment_status || 'pending'}</p>
                </div>
              </div>

              {creatingPaymentSession && !paymentSnapshot ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Đang tạo session VNPAY và mã QR thanh toán...
                </div>
              ) : paymentSnapshot?.payment_status === 'paid' ? (
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-emerald-50/50 p-8 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                    ✓
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800">Thanh toán VNPAY thành công!</h3>
                  <p className="text-sm text-slate-500">
                    Hệ thống đã ghi nhận thanh toán mô phỏng. Lịch hẹn hiện tại đã được xác nhận (Confirmed).
                  </p>
                  <div className="pt-4 flex justify-center gap-3">
                    <Button variant="secondary" onClick={() => navigate('/receptionist/appointments')}>Về Danh sách Lịch hẹn</Button>
                    <Button onClick={handleReset}>Tạo lịch hẹn khác</Button>
                  </div>
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
                        QR này được tạo theo session VNPAY mock. Lịch hẹn sẽ chuyển sang confirmed khi nhận mô phỏng callback.
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-2">
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
                      <Button variant="secondary" onClick={() => navigate('/receptionist/appointments')}>
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
