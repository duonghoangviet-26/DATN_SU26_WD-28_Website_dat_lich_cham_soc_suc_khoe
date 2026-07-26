import { useState } from 'react'
import { ReceptionistBookingSlot } from '@/services/receptionist-booking.service'

export interface BookingStep3ConfirmProps {
  selectedDate: string
  selectedSlot: ReceptionistBookingSlot | null
  selectedDoctor: any | null
  patientName: string
  patientPhone: string
  symptoms: string
  bookingFor: 'self' | 'member' | 'other'
  onPrev: () => void
  onSubmit: (paymentMethod: 'cash' | 'transfer') => void
  isSubmitting: boolean
}

export default function BookingStep3Confirm({
  selectedDate,
  selectedSlot,
  selectedDoctor,
  patientName,
  patientPhone,
  symptoms,
  bookingFor,
  onPrev,
  onSubmit,
  isSubmitting,
}: BookingStep3ConfirmProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800">Xác nhận thông tin Đặt lịch</h3>
        <p className="text-xs text-slate-500 mt-1">Vui lòng kiểm tra kỹ các thông tin trước khi xác nhận tạo lịch hẹn.</p>
      </div>

      <div className="space-y-4 text-sm bg-slate-50 p-5 rounded-xl border border-slate-200">
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Bác sĩ:</div>
          <div className="col-span-2 font-bold text-slate-800">
            {selectedDoctor ? `BS. ${selectedDoctor.ho_ten}` : 'Bác sĩ chuyên khoa'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Ngày khám:</div>
          <div className="col-span-2 font-bold text-slate-800">{selectedDate}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Khung giờ:</div>
          <div className="col-span-2 font-bold text-slate-800">
            {selectedSlot?.gio_bat_dau} - {selectedSlot?.gio_ket_thuc}
            {selectedSlot?.phong_kham && (
              <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                {selectedSlot.phong_kham}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Đối tượng:</div>
          <div className="col-span-2 font-medium text-slate-700">
            {bookingFor === 'self' && 'Tự khám (Chủ tài khoản)'}
            {bookingFor === 'member' && 'Đặt hộ (Thành viên gia đình)'}
            {bookingFor === 'other' && 'Người khác / Khách vãng lai'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Họ tên:</div>
          <div className="col-span-2 font-bold text-slate-800">{patientName}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Số ĐT:</div>
          <div className="col-span-2 font-bold text-slate-800">{patientPhone}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Triệu chứng:</div>
          <div className="col-span-2 font-medium text-slate-700">{symptoms}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Phương thức thanh toán</h3>
        <div className="grid grid-cols-2 gap-4">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
              paymentMethod === 'cash'
                ? 'border-brand-500 bg-brand-50 shadow-sm shadow-brand-100 ring-1 ring-brand-500'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={paymentMethod === 'cash'}
              onChange={() => setPaymentMethod('cash')}
              className="h-4 w-4 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <div className="font-semibold text-slate-800">Tiền mặt</div>
              <div className="text-xs text-slate-500">Thanh toán trực tiếp tại quầy</div>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
              paymentMethod === 'transfer'
                ? 'border-brand-500 bg-brand-50 shadow-sm shadow-brand-100 ring-1 ring-brand-500'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="transfer"
              checked={paymentMethod === 'transfer'}
              onChange={() => setPaymentMethod('transfer')}
              className="h-4 w-4 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <div className="font-semibold text-slate-800">Chuyển khoản (VNPAY)</div>
              <div className="text-xs text-slate-500">Tạo mã QR để khách thanh toán</div>
            </div>
          </label>
        </div>
      </div>

      <div className="mt-8 flex justify-between border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={onPrev}
          disabled={isSubmitting}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all disabled:opacity-50"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={() => onSubmit(paymentMethod)}
          disabled={isSubmitting}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Đang xử lý...
            </>
          ) : (
            'Xác nhận tạo lịch'
          )}
        </button>
      </div>
    </div>
  )
}
