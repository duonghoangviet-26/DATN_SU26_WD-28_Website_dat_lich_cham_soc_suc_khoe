import { useState, useEffect, useRef } from 'react'
import Input from '@/components/common/Input'
import Textarea from '@/components/common/Textarea'
import { receptionistBookingService, ReceptionistFamilyMember } from '@/services/receptionist-booking.service'

/**
 * Các props truyền vào cho Bước 2 (Nhập thông tin bệnh nhân)
 */
export interface BookingStep2PatientInfoProps {
  patientName: string
  setPatientName: (val: string) => void
  patientPhone: string
  setPatientPhone: (val: string) => void
  symptoms: string
  setSymptoms: (val: string) => void
  bookingFor: 'self' | 'member' | 'other'
  setBookingFor: (val: 'self' | 'member' | 'other') => void
  selectedMemberId: string
  setSelectedMemberId: (val: string) => void

  onPrev: () => void
  onNext: () => void
}

export default function BookingStep2PatientInfo({
  patientName,
  setPatientName,
  patientPhone,
  setPatientPhone,
  symptoms,
  setSymptoms,
  bookingFor,
  setBookingFor,
  selectedMemberId,
  setSelectedMemberId,
  onPrev,
  onNext,
}: BookingStep2PatientInfoProps) {
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [foundUserId, setFoundUserId] = useState<string | null>(null)
  const [familyMembers, setFamilyMembers] = useState<ReceptionistFamilyMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)

  /**
   * Tự động tìm kiếm tài khoản bệnh nhân và tải danh sách thành viên gia đình
   * khi số điện thoại thay đổi (sau 500ms delay).
   */
  useEffect(() => {
    if (patientPhone.length >= 10 && patientPhone.startsWith('0')) {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
      
      searchTimeoutRef.current = window.setTimeout(() => {
        setIsLookingUp(true)
        receptionistBookingService.lookupUserByPhone(patientPhone)
          .then((res) => {
            if (res.found && res.user) {
              setFoundUserId(res.user._id)
              // Tự động load family members của người này
              return receptionistBookingService.getFamilyGroup(res.user._id)
            } else {
              // Không tìm thấy user, đặt về mặc định là 'other'
              setFoundUserId(null)
              setFamilyMembers([])
              setBookingFor('other')
              setSelectedMemberId('')
              return null
            }
          })
          .then((familyGroup) => {
            if (familyGroup) {
              setFamilyMembers(familyGroup.members || [])
              // Nếu trước đó đang chọn "self" hoặc "member" thì giữ,
              // nếu không thì gán default là "self"
              if (bookingFor === 'other') {
                setBookingFor('self')
                const chuHo = familyGroup.members.find(m => m.la_chu_ho)
                if (chuHo) {
                  setPatientName(chuHo.ho_ten)
                }
              }
            }
          })
          .catch((err) => {
            console.error('Lỗi khi tìm kiếm bệnh nhân:', err)
          })
          .finally(() => {
            setIsLookingUp(false)
          })
      }, 500)
    } else {
      setFoundUserId(null)
      setFamilyMembers([])
      setBookingFor('other')
    }

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientPhone])

  const handleValidateAndNext = () => {
    if (bookingFor === 'member' && !selectedMemberId) {
      setError('Vui lòng chọn một thành viên trong danh sách hoặc chuyển sang Đặt hộ người khác.')
      return
    }

    const nameTrimmed = patientName.trim()
    const phoneTrimmed = patientPhone.trim()

    if (!nameTrimmed || !phoneTrimmed) {
      setError('Họ tên và Số điện thoại liên hệ không được bỏ trống.')
      return
    }

    const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠƯưăâêôơưẠ-ỹđĐ\s']{2,100}$/
    if (!nameRegex.test(nameTrimmed)) {
      setError('Họ tên bệnh nhân không hợp lệ (nhập ít nhất 2 ký tự, không chứa số).')
      return
    }

    const phoneRegex = /^0\d{9}$/
    if (!phoneRegex.test(phoneTrimmed)) {
      setError('Số điện thoại không hợp lệ (phải đủ 10 số và bắt đầu bằng số 0).')
      return
    }

    if (!symptoms.trim() || symptoms.trim().length < 5) {
      setError('Vui lòng nhập chi tiết mô tả triệu chứng (ít nhất 5 ký tự).')
      return
    }

    setError(null)
    onNext()
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition-all">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Thông tin người khám & Triệu chứng</h3>
        {isLookingUp && (
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span> Đang tra cứu số điện thoại...
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100 font-medium">
          🚨 {error}
        </div>
      )}

      {/* Box nhập số điện thoại đầu tiên để kích hoạt tìm kiếm */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <Input
          label="Số điện thoại liên hệ (Bắt buộc nhập trước)"
          placeholder="Nhập 10 số di động để tra cứu tự động..."
          value={patientPhone}
          onChange={(event) => setPatientPhone(event.target.value)}
          required
        />
        {foundUserId ? (
          <p className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <span className="text-sm">✅</span> Đã tìm thấy tài khoản bệnh nhân trên hệ thống!
          </p>
        ) : (
          patientPhone.length >= 10 && !isLookingUp && (
            <p className="mt-2 text-xs font-semibold text-amber-600 flex items-center gap-1">
              <span className="text-sm">⚠️</span> Số điện thoại này chưa có tài khoản. Đặt lịch dưới dạng khách vãng lai.
            </p>
          )
        )}
      </div>

      {/* Hiển thị tùy chọn đối tượng khám nếu tìm thấy tài khoản */}
      {foundUserId && (
        <div className="space-y-3 animate-fade-in">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Đối tượng khám bệnh
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setBookingFor('self')
                setSelectedMemberId('')
                const chuHo = familyMembers.find(m => m.la_chu_ho)
                if (chuHo) setPatientName(chuHo.ho_ten)
              }}
              className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                bookingFor === 'self'
                  ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xs font-bold">🙋‍♂️ Chủ tài khoản</span>
              <span className="mt-1 text-[10px] font-normal text-slate-400">Đặt cho chính người này</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBookingFor('member')
                if (familyMembers.length > 0) {
                  const firstMember = familyMembers.find(m => !m.la_chu_ho) || familyMembers[0]
                  setSelectedMemberId(firstMember.id)
                  setPatientName(firstMember.ho_ten)
                }
              }}
              className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                bookingFor === 'member'
                  ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xs font-bold">👨‍👩‍👧 Người nhà đã lưu</span>
              <span className="mt-1 text-[10px] font-normal text-slate-400">Chọn từ hồ sơ gia đình</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBookingFor('other')
                setPatientName('')
                setSelectedMemberId('')
              }}
              className={`flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all ${
                bookingFor === 'other'
                  ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500 font-bold text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xs font-bold">👥 Người khác</span>
              <span className="mt-1 text-[10px] font-normal text-slate-400">Nhập thủ công họ tên</span>
            </button>
          </div>
        </div>
      )}

      {/* Hiển thị form tùy theo bookingFor */}
      {bookingFor === 'member' && foundUserId && (
        <div className="space-y-4 animate-fade-in bg-slate-50 p-4 rounded-xl border border-slate-100">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Chọn thành viên gia đình
          </label>
          {familyMembers.length === 0 ? (
            <p className="text-sm text-red-500">Người này chưa thêm hồ sơ người nhà nào.</p>
          ) : (
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
                      ? 'border-brand-500 bg-white ring-1 ring-brand-500 font-bold text-brand-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                >
                  <h4 className="text-xs font-bold leading-snug">{member.ho_ten}</h4>
                  <p className="mt-1 text-[9px] text-slate-400 uppercase font-semibold">
                    {member.gioi_tinh === 'nam' ? 'Nam' : member.gioi_tinh === 'nu' ? 'Nữ' : 'Khác'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Họ và tên bệnh nhân"
          placeholder="Nhập họ tên đầy đủ (ví dụ: Nguyễn Văn A)"
          value={patientName}
          onChange={(event) => setPatientName(event.target.value)}
          disabled={bookingFor === 'member' || (bookingFor === 'self' && !!foundUserId)}
          required
        />
        
        <Textarea
          label="Mô tả triệu chứng bệnh"
          placeholder="Ví dụ: Đau rát họng khi nuốt, sốt nhẹ, ho đờm kéo dài..."
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
          required
        />
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-100 mt-6">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={handleValidateAndNext}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  )
}
