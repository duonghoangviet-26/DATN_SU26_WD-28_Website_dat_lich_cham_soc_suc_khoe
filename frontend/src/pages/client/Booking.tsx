import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { mockDoctors } from '@/mock/doctors'
import { mockServices } from '@/mock/services'
import Breadcrumb from '@/components/common/Breadcrumb'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Textarea from '@/components/common/Textarea'
import Toast from '@/components/common/Toast'
import Loading from '@/components/common/Loading'

// Mock slots list for doctors
const MOCK_TIME_SLOTS = [
  '08:00 - 08:30',
  '08:30 - 09:00',
  '09:00 - 09:30',
  '09:30 - 10:00',
  '10:00 - 10:30',
  '10:30 - 11:00',
  '14:00 - 14:30',
  '14:30 - 15:00',
  '15:00 - 15:30',
  '15:30 - 16:00',
]

// Simulate some random booked slots to test disabled states
const SIMULATED_BOOKED_SLOTS: Record<string, string[]> = {
  '1': ['09:00 - 09:30', '14:30 - 15:00'],
  '2': ['08:00 - 08:30', '10:30 - 11:00'],
}

export default function Booking() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Guard route immediately on mount
  useEffect(() => {
    if (!authLoading && !user) {
      const params = searchParams.toString()
      const redirectPath = params ? `/booking?${params}` : '/booking'
      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    }
  }, [user, authLoading, searchParams, navigate])

  // Routing params fallback
  const queryDoctorId = searchParams.get('doctor_id')
  const queryServiceId = searchParams.get('service_id')

  // Booking Wizard States
  const [step, setStep] = useState<number>(1)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(queryDoctorId || '')
  const [selectedServiceId, setSelectedServiceId] = useState<string>(queryServiceId || '')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')

  // Form States
  const [patientName, setPatientName] = useState(user?.ho_ten || '')
  const [patientPhone, setPatientPhone] = useState(user?.so_dien_thoai || '')
  const [symptoms, setSymptoms] = useState('')

  // Notification states
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Generate T+7 dates list
  const [dates, setDates] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const datesList = []
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(today)
      nextDate.setDate(today.getDate() + i)
      
      // Format to YYYY-MM-DD
      const yyyy = nextDate.getFullYear()
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0')
      const dd = String(nextDate.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`

      // Format human-readable label
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

  // Sync user info if loaded late
  useEffect(() => {
    if (user) {
      setPatientName(user.ho_ten)
      setPatientPhone(user.so_dien_thoai || '')
    }
  }, [user])

  const selectedDoctor = mockDoctors.find((d) => String(d.id) === selectedDoctorId)
  const selectedService = mockServices.find((s) => s.id === selectedServiceId)

  const availableDoctors = selectedServiceId
    ? mockDoctors.filter(
        (d) =>
          d.loai === 'specialist' &&
          d.trang_thai_duyet === 'approved' &&
          d.related_services.some((rs) => rs.id === selectedServiceId)
      )
    : []

  const handleSelectService = (id: string) => {
    setSelectedServiceId(id)
    setSelectedDoctorId('') // Reset selected doctor when service changes
  }

  // Handle Wizard Steps Navigation
  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedServiceId) {
        setToast('Vui lòng chọn dịch vụ khám lâm sàng.')
        return
      }
      if (!selectedDoctorId) {
        setToast('Vui lòng chọn bác sĩ phụ trách khám.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!selectedDate || !selectedSlot) {
        setToast('Vui lòng chọn ngày khám và khung giờ còn trống.')
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (!patientName.trim() || !patientPhone.trim()) {
        setToast('Họ tên và Số điện thoại liên hệ là bắt buộc.')
        return
      }
      if (!symptoms.trim()) {
        setToast('Vui lòng mô tả sơ qua triệu chứng tai mũi họng đang gặp phải.')
        return
      }
      setStep(4)
    }
  }

  // Prevent flash or render if checking auth
  if (authLoading) {
    return <Loading message="Đang kiểm tra thông tin đăng nhập..." />
  }

  if (!user) {
    return null
  }

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  // Handle final confirmation
  const handleConfirmBooking = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      // Save appointment mock to localStorage to display in profile later
      const newApp = {
        _id: `app-mock-${Date.now()}`,
        benh_nhan: patientName,
        sdt_benh_nhan: patientPhone,
        bac_si: selectedDoctor?.ho_ten || '',
        chuyen_khoa: 'Tai Mũi Họng',
        ngay_kham: selectedDate,
        gio_kham: selectedSlot,
        loai_kham: 'clinic',
        status: 'pending',
        payment_status: 'unpaid',
        gia_kham: selectedService?.gia || 0,
        ten_dich_vu: selectedService?.ten || '',
        ly_do_kham: symptoms,
      }
      const existing = JSON.parse(localStorage.getItem('my_appointments') || '[]')
      localStorage.setItem('my_appointments', JSON.stringify([newApp, ...existing]))

      // Go to success
      navigate('/profile?booked=true')
    }, 1200)
  }

  // Check if slot is already booked
  const isSlotBooked = (slot: string) => {
    if (selectedDoctorId) {
      const booked = SIMULATED_BOOKED_SLOTS[selectedDoctorId] || []
      return booked.includes(slot)
    }
    return false
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Đặt lịch khám' }]} />

      <div className="text-left space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Đặt Lịch Khám Trực Tuyến</h1>
        <p className="text-sm text-slate-500">
          Vui lòng hoàn thành các bước bên dưới để nhận mã số khám đúng giờ hẹn tại phòng khám.
        </p>
      </div>

      {/* STEP INDICATORS */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-6 text-center">
        {[
          { num: 1, label: 'Dịch vụ & Bác sĩ' },
          { num: 2, label: 'Thời gian khám' },
          { num: 3, label: 'Thông tin triệu chứng' },
          { num: 4, label: 'Xác nhận' },
        ].map((s) => (
          <div key={s.num} className="space-y-2">
            <div
              className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${
                step >= s.num ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.num}
            </div>
            <p className={`hidden sm:block text-xs font-semibold ${step >= s.num ? 'text-slate-800' : 'text-slate-400'}`}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* STEP 1: SELECT SERVICE & MATCHING DOCTOR */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          {/* Chọn dịch vụ cần khám */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Chọn dịch vụ Tai Mũi Họng</label>
            <div className="grid gap-4 sm:grid-cols-2">
              {mockServices
                .filter((s) => s.status === 'active')
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectService(s.id)}
                    className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                      selectedServiceId === s.id
                        ? 'border-brand-500 bg-brand-50/20 ring-1 ring-brand-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl mt-1">🩺</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-800">{s.ten}</h4>
                      <p className="text-[10px] text-slate-500 leading-tight mt-1 line-clamp-2">{s.mo_ta_ngan}</p>
                      <p className="text-xs font-bold text-brand-600 mt-2">{s.gia.toLocaleString('vi-VN')} đ</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Chọn bác sĩ tương ứng khi chọn dịch vụ */}
          {selectedServiceId && (
            <div className="space-y-3 border-t border-slate-50 pt-4">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">2. Chọn bác sĩ phụ trách chuyên khoa</label>
              {availableDoctors.length === 0 ? (
                <p className="text-xs text-slate-400">Hiện chưa có lịch bác sĩ thực hiện dịch vụ này. Vui lòng chọn dịch vụ khác.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableDoctors.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDoctorId(String(d.id))}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                        selectedDoctorId === String(d.id)
                          ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-full overflow-hidden">
                        {d.anh_dai_dien ? (
                          <img src={d.anh_dai_dien} alt={d.ho_ten} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-brand-100 text-brand-600 font-extrabold text-lg">
                            {d.ho_ten.split(' ').pop()?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-snug">{d.ho_ten}</h4>
                        <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{d.bang_cap.split('chuyên ngành')[0]}</p>
                        <p className="text-[9px] text-brand-600 font-bold mt-1">⭐ {d.diem_danh_gia.toFixed(1)} ({d.so_danh_gia} đánh giá)</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SELECT DATE AND SLOTS */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          {/* Select Date */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chọn ngày khám</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d.value)
                    setSelectedSlot('') // clear previous hours
                  }}
                  className={`flex flex-col items-center justify-center shrink-0 w-24 py-2.5 border rounded-xl text-center transition-all ${
                    selectedDate === d.value
                      ? 'border-brand-500 bg-brand-50/20 text-brand-700 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold leading-tight">{d.label.split(',')[0]}</span>
                  <span className="text-base font-bold leading-normal mt-0.5">{d.label.split(',')[1].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Select Slot */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chọn khung giờ khám</label>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
              {MOCK_TIME_SLOTS.map((slot) => {
                const booked = isSlotBooked(slot)
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={booked}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                      booked
                        ? 'bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed line-through'
                        : selectedSlot === slot
                        ? 'border-brand-500 bg-brand-500 text-white font-bold shadow-md shadow-brand-100'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white'
                    }`}
                  >
                    {slot.split(' - ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PATIENT INFO & SYMPTOMS */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-2">Thông tin người khám bệnh</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên bệnh nhân"
              placeholder="Nhập họ tên đầy đủ..."
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              required
            />
            <Input
              label="Số điện thoại liên hệ"
              placeholder="Nhập số di động..."
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Mô tả triệu chứng bệnh"
            placeholder="Ví dụ: Đau tai trong kéo dài, ho khan rát họng, khàn tiếng..."
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            required
          />
        </div>
      )}

      {/* STEP 4: CONFIRMATION SUMMARY */}
      {step === 4 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left space-y-6">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-2">Tóm tắt lịch hẹn</h3>
          
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-600">
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-slate-500">Hình thức:</span> Khám trực tiếp tại phòng khám
              </p>
              <p>
                <span className="font-semibold text-slate-500">Dịch vụ chỉ định:</span>{' '}
                <span className="font-bold text-slate-800">{selectedService?.ten}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Bác sĩ phụ trách:</span>{' '}
                <span className="font-bold text-slate-800">{selectedDoctor?.ho_ten}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Thời gian:</span>{' '}
                <span className="font-semibold text-brand-600">{selectedSlot}</span>, ngày {selectedDate}
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-semibold text-slate-500">Người khám:</span>{' '}
                <span className="font-bold text-slate-800">{patientName}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Điện thoại:</span> {patientPhone}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Triệu chứng:</span> {symptoms}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-400 leading-relaxed">
            * Lịch hẹn sau khi đăng ký sẽ ở trạng thái <strong>Chờ duyệt (Pending)</strong>. Vui lòng có mặt trước giờ khám 10 phút tại quầy tiếp đón để làm thủ tục.
          </div>
        </div>
      )}

      {/* WIZARD CONTROLS */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <Button variant="secondary" onClick={handlePrevStep}>
            Quay lại
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button onClick={handleNextStep}>Tiếp tục</Button>
        ) : (
          <Button onClick={handleConfirmBooking} loading={loading}>
            Xác nhận đặt lịch khám
          </Button>
        )}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
