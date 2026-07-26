import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import Breadcrumb from '@/components/common/Breadcrumb'
import Toast from '@/components/common/Toast'
import {
  receptionistBookingService,
  CreatedReceptionistBookingResult,
  ReceptionistBookingSlot,
  ReceptionistPaymentStatusResult,
  ReceptionistBookingDoctor,
} from '@/services/receptionist-booking.service'

// Import các Component con đã được chia nhỏ
import BookingStep1DateSlot from '@/components/receptionist/booking/BookingStep1DateSlot'
import BookingStep2PatientInfo from '@/components/receptionist/booking/BookingStep2PatientInfo'
import BookingStep3Confirm from '@/components/receptionist/booking/BookingStep3Confirm'
import BookingStep4Payment from '@/components/receptionist/booking/BookingStep4Payment'

type BookingStep = 1 | 2 | 3 | 4

export default function ReceptionistBooking() {
  const navigate = useNavigate()

  // --- Trạng thái chung ---
  const [step, setStep] = useState<BookingStep>(1)
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'warning'} | null>(null)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  
  // --- Trạng thái Bước 1: Chọn ngày và khung giờ ---
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [dates, setDates] = useState<{ value: string; label: string }[]>([])
  // Lưu trữ danh sách slots hiện tại để lấy được thông tin chi tiết slot khi confirm
  const [currentSlots, setCurrentSlots] = useState<ReceptionistBookingSlot[]>([])

  // --- Trạng thái Bước 2: Thông tin Bệnh nhân ---
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [bookingFor, setBookingFor] = useState<'self' | 'member' | 'other'>('other')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  
  // Trạng thái kết quả tạo
  const [createdBooking, setCreatedBooking] = useState<CreatedReceptionistBookingResult | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [creatingPaymentSession, setCreatingPaymentSession] = useState(false)
  const [paymentSnapshot, setPaymentSnapshot] = useState<ReceptionistPaymentStatusResult | null>(null)

  // Validate form info
  const handleValidateStep2 = () => {
    if (!patientName.trim()) {
      setToast({ message: 'Vui lòng nhập họ tên khách hàng.', type: 'error' })
      return false
    }
    if (!patientPhone.trim()) {
      setToast({ message: 'Vui lòng nhập số điện thoại khách hàng.', type: 'error' })
      return false
    }
    if (!/^0\d{9,10}$/.test(patientPhone.trim())) {
      setToast({ message: 'Số điện thoại không hợp lệ.', type: 'error' })
      return false
    }
    return true
  }

  // Khởi tạo danh sách 7 ngày tiếp theo
  useEffect(() => {
    const datesList = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateString = date.toISOString().split('T')[0]
      const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : date.toLocaleDateString('vi-VN')
      datesList.push({ value: dateString, label })
    }
    setDates(datesList)
    if (datesList.length > 0) {
      setSelectedDate(datesList[0].value)
    }
  }, [])

  // Fetch danh sách bác sĩ (giống client để faking tên bác sĩ khi chọn tự động)
  const [doctors, setDoctors] = useState<ReceptionistBookingDoctor[]>([])
  useEffect(() => {
    receptionistBookingService.getDoctors()
      .then(setDoctors)
      .catch(() => {})
  }, [])

  // Dùng để lấy chi tiết slot đang được chọn
  useEffect(() => {
    if (selectedDate) {
      receptionistBookingService.getSlots('all', selectedDate).then(setCurrentSlots).catch(() => {})
    }
  }, [selectedDate])

  const selectedSlot = useMemo(
    () => currentSlots.find((s) => s.id === selectedSlotId) || null,
    [currentSlots, selectedSlotId]
  )

  const selectedDoctor = useMemo(() => {
    if (doctors.length === 0) return null
    // Random 1 bác sĩ trong danh sách để giả lập việc phân bổ
    const randomIndex = Math.floor(Math.random() * doctors.length)
    return doctors[randomIndex]
  }, [doctors, selectedSlotId])

  // Xử lý Gửi Lịch Hẹn lên hệ thống
  const handleSubmitBooking = async (paymentMethod: 'cash' | 'transfer') => {
    if (!selectedDate || !selectedSlotId) {
      setToast({ message: 'Vui lòng chọn đầy đủ ngày và khung giờ khám.', type: 'error' })
      return
    }

    setSubmittingBooking(true)
    setSelectedPaymentMethod(paymentMethod)
    try {
      const payload: any = {
        doctor_id: 'auto', // LUÔN GÁN BẰNG AUTO THEO YÊU CẦU MỚI CỦA LỄ TÂN
        schedule_id: selectedSlot?.schedule_id, // Lấy từ slot để backend dùng tạm tra cứu
        slot_id: selectedSlotId,
        ngay_kham: selectedDate,
        ten_khach: patientName.trim(),
        so_dien_thoai_khach: patientPhone.trim(),
        ly_do_kham: symptoms.trim(),
        payment_method: paymentMethod, // Sử dụng phương thức Lễ tân đã chọn
      }

      if (bookingFor === 'member' && selectedMemberId) {
        payload.member_id = selectedMemberId
      }

      // Backend tự động tìm userID bằng phone trong logic controller
      const result = await receptionistBookingService.createBooking(payload)
      setCreatedBooking(result)
      
      setToast({ message: 'Lịch khám đã được khởi tạo và phân bổ bác sĩ thành công!', type: 'success' })
      setStep(4) // Chuyển sang bước Hoàn tất
    } catch (error: any) {
      setToast({ 
        message: error.response?.data?.message || error.message || 'Lỗi khi tạo lịch hẹn.', 
        type: 'error' 
      })
    } finally {
      setSubmittingBooking(false)
    }
  }

  // Render thanh tiến trình (Stepper)
  const renderStepper = () => {
    const steps = [
      { id: 1, title: 'Ngày & Giờ' },
      { id: 2, title: 'Thông tin' },
      { id: 3, title: 'Xác nhận' },
      { id: 4, title: 'Hoàn tất' }
    ]

    return (
      <div className="mb-8 flex w-full items-center justify-between">
        {steps.map((s, idx) => {
          const isActive = step === s.id
          const isCompleted = step > s.id

          return (
            <div key={s.id} className="flex w-full items-center">
              <div className="flex flex-col items-center relative">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100 shadow-brand-300'
                      : isCompleted
                      ? 'bg-emerald-500 text-white shadow-emerald-200'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.id
                  )}
                </div>
                <span
                  className={`absolute -bottom-6 w-24 text-center text-xs font-bold ${
                    isActive ? 'text-brand-600' : isCompleted ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-2 h-1 w-full flex-1 rounded-full transition-all ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-100'
                  }`}
                ></div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Bảng điều khiển', to: '/receptionist' },
          { label: 'Lịch hẹn', to: '/receptionist/appointments' },
          { label: 'Đặt lịch mới' },
        ]}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-6 mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Đặt lịch khám mới</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Dành cho Lễ tân hỗ trợ khách hàng tại quầy (Tự động xếp bác sĩ).
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl pt-4">
        {renderStepper()}

        <div className="mt-10">
          {step === 1 && (
            <BookingStep1DateSlot
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedSlotId={selectedSlotId}
              onSlotChange={setSelectedSlotId}
              dates={dates}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <BookingStep2PatientInfo
              patientName={patientName}
              setPatientName={setPatientName}
              patientPhone={patientPhone}
              setPatientPhone={setPatientPhone}
              symptoms={symptoms}
              setSymptoms={setSymptoms}
              bookingFor={bookingFor}
              setBookingFor={setBookingFor}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              onPrev={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <BookingStep3Confirm
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              selectedDoctor={selectedDoctor}
              patientName={patientName}
              patientPhone={patientPhone}
              symptoms={symptoms}
              bookingFor={bookingFor}
              onPrev={() => setStep(2)}
              onSubmit={handleSubmitBooking}
              isSubmitting={submittingBooking}
            />
          )}

          {step === 4 && (
            <BookingStep4Payment
              createdBooking={createdBooking}
              paymentMethod={selectedPaymentMethod}
              onDone={() => navigate('/receptionist/appointments')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
