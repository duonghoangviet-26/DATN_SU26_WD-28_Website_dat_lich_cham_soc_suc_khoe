import { useState, useEffect } from 'react'
import { receptionistBookingService, ReceptionistBookingSlot } from '@/services/receptionist-booking.service'

/**
 * Giao diện Chọn Ngày và Khung giờ dành riêng cho Lễ tân
 * Tính năng này đã được tối ưu hóa để Lễ tân có thể chọn khung giờ trống chung,
 * sau đó hệ thống tự động gán bác sĩ (doctor_id = 'auto').
 */

export interface BookingStep1DateSlotProps {
  /** Ngày hiện tại đang được chọn (định dạng YYYY-MM-DD) */
  selectedDate: string
  /** Hàm callback khi Lễ tân thay đổi ngày khám */
  onDateChange: (date: string) => void
  /** Khung giờ hiện tại đang được chọn */
  selectedSlotId: string
  /** Hàm callback khi Lễ tân chọn 1 khung giờ cụ thể */
  onSlotChange: (slotId: string) => void
  /** Danh sách các ngày khả dụng trong 7 ngày tới */
  dates: { value: string; label: string }[]
  /** Trigger callback khi bấm nút Tiếp tục */
  onNext: () => void
}

export default function BookingStep1DateSlot({
  selectedDate,
  onDateChange,
  selectedSlotId,
  onSlotChange,
  dates,
  onNext
}: BookingStep1DateSlotProps) {
  const [slots, setSlots] = useState<ReceptionistBookingSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Effect tự động fetch slots khi selectedDate thay đổi
   * Gửi `doctorId = 'all'` để lấy toàn bộ slot trống
   */
  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      return
    }

    let ignore = false
    setLoadingSlots(true)
    setError(null)
    onSlotChange('') // Reset slot mỗi khi đổi ngày

    // Lấy tất cả slot trống trong ngày
    receptionistBookingService.getSlots('all', selectedDate)
      .then((data) => {
        if (!ignore) {
          setSlots(data)
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setSlots([])
          setError(err.response?.data?.message || err.message || 'Không thể tải danh sách khung giờ.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingSlots(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [selectedDate, onSlotChange])

  /**
   * Hàm kiểm tra dữ liệu đầu vào trước khi next sang bước sau
   */
  const handleValidateAndNext = () => {
    if (!selectedDate) {
      setError('Vui lòng chọn một ngày khám.')
      return
    }
    if (!selectedSlotId) {
      setError('Vui lòng chọn một khung giờ khám còn trống.')
      return
    }
    setError(null)
    onNext()
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md">
      <div className="space-y-4">
        {/* Tiêu đề & Chọn ngày bằng input date */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            1. Chọn ngày khám
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Chọn ngày khác:</span>
            <input
              type="date"
              value={selectedDate}
              min={(() => {
                const d = new Date()
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              })()}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition cursor-pointer"
            />
          </div>
        </div>

        {/* Băng chuyền chọn ngày */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {dates.map((date) => {
            const isSelected = selectedDate === date.value
            return (
              <button
                key={date.value}
                type="button"
                onClick={() => onDateChange(date.value)}
                className={`flex w-28 shrink-0 flex-col items-center justify-center rounded-xl border py-3 text-center transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/30 font-bold text-brand-700 ring-2 ring-brand-500 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-brand-200'
                }`}
              >
                <span className="text-[11px] font-semibold uppercase leading-tight">
                  {date.label.split(',')[0]}
                </span>
                <span className="mt-0.5 text-base font-extrabold leading-normal">
                  {date.label.split(',')[1]?.trim() || date.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
          2. Chọn khung giờ khám
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100 font-medium">
            🚨 {error}
          </div>
        )}

        {loadingSlots ? (
          <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 animate-pulse border border-slate-100">
            Đang quét danh sách khung giờ từ tất cả các bác sĩ...
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center border border-slate-100">
            <p className="text-sm font-semibold text-slate-600">
              Không có khung giờ khám còn trống cho ngày đã chọn.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Vui lòng chọn một ngày khác phía trên.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {slots.map((slot) => {
              const isSelected = selectedSlotId === slot.id
              const isFull = slot.is_full
              
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => !isFull && onSlotChange(slot.id)}
                  disabled={isFull}
                  className={`relative flex flex-col items-center justify-center rounded-xl border py-3 px-2 text-center transition-all overflow-hidden ${
                    isFull
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                      : isSelected
                      ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-200 ring-2 ring-brand-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  <span className={`text-sm font-extrabold tracking-tight ${isFull ? 'line-through' : ''}`}>
                    {slot.gio_bat_dau}
                  </span>
                  {slot.phong_kham && !isFull && (
                    <span className={`mt-0.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {slot.phong_kham}
                    </span>
                  )}
                  {isFull && (
                    <div className="absolute top-0 right-0 rounded-bl-lg bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      Đầy
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
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
