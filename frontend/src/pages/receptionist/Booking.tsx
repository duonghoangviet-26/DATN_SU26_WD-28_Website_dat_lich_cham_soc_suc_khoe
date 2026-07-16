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
} from '@/services/receptionist-booking.service'

type BookingStep = 1 | 2 | 3 | 4 | 5

function formatSlotLabel(slot: ReceptionistBookingSlot) {
  return `${slot.gio_bat_dau} - ${slot.gio_ket_thuc}`
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
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

  const [dates, setDates] = useState<{ value: string; label: string }[]>([])
  const [doctors, setDoctors] = useState<ReceptionistBookingDoctor[]>([])
  const [slots, setSlots] = useState<ReceptionistBookingSlot[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  const [createdBooking, setCreatedBooking] = useState<CreatedReceptionistBookingResult | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

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
    if (step === 5 && createdBooking?.qr_payload) {
      let cancelled = false
      QRCode.toDataURL(createdBooking.qr_payload, {
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
            setToast('Không render được mã QR')
          }
        })
      return () => { cancelled = true }
    }
  }, [step, createdBooking?.qr_payload])

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) || null
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) || null

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
      const created = await receptionistBookingService.createBooking({
        doctor_id: selectedDoctor.id,
        schedule_id: selectedSlot.schedule_id,
        slot_id: selectedSlot.id,
        ngay_kham: selectedDate,
        ten_khach: patientName.trim(),
        so_dien_thoai_khach: patientPhone.trim(),
        ly_do_kham: symptoms.trim() || undefined,
        payment_method: paymentMethod,
      })
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
            <div className="space-y-4">
              <h3 className="text-xl font-extrabold text-slate-800">Chờ Khách Thanh Toán</h3>
              <p className="text-sm text-slate-500">
                Lịch hẹn đã tạo, vui lòng đưa khách hàng quét mã QR dưới đây để chuyển khoản.
              </p>
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="Fake QR" className="h-64 w-64 rounded-xl shadow-sm" />
                ) : (
                  <div className="grid h-64 w-64 place-items-center rounded-xl bg-white text-slate-400">
                    Đang tạo mã QR...
                  </div>
                )}
                <p className="text-xs font-semibold text-slate-400">Mã QR giả định cho Lễ tân</p>
              </div>
              <div className="pt-4">
                <Button onClick={handleReset}>Tạo lịch hẹn khác</Button>
              </div>
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
