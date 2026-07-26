import { CreatedReceptionistBookingResult, ReceptionistPaymentGatewaySnapshot } from '@/services/receptionist-booking.service'

export interface BookingStep4PaymentProps {
  createdBooking: CreatedReceptionistBookingResult | null
  paymentSnapshot: ReceptionistPaymentGatewaySnapshot | null
  onRefreshSession: () => void
  isRefreshing: boolean
  onOpenPaymentPage: () => void
  onDone: () => void
}

export default function BookingStep4Payment({
  createdBooking,
  paymentSnapshot,
  onRefreshSession,
  isRefreshing,
  onOpenPaymentPage,
  onDone,
}: BookingStep4PaymentProps) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 animate-bounce">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h3 className="text-xl font-black text-slate-800">Đặt lịch thành công!</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        Lịch hẹn của bệnh nhân đã được lưu trên hệ thống và bác sĩ đã được phân bổ thành công.
      </p>

      {createdBooking?.qr_payload ? (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6 inline-block w-full max-w-sm">
          <p className="text-xs font-bold text-slate-600 uppercase mb-4 tracking-wider">Quét mã QR để thanh toán</p>
          <div className="flex justify-center mb-4 p-2 bg-white rounded-lg shadow-sm border border-slate-200 inline-block">
            {/* Giả lập QR code */}
            <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-300">
              <span className="text-[10px] font-bold uppercase rotate-[-45deg]">QR CODE</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefreshSession}
              disabled={isRefreshing}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
            >
              {isRefreshing ? 'Đang tạo lại...' : 'Tạo lại mã QR'}
            </button>
            <button
              onClick={onOpenPaymentPage}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 transition-all shadow-md shadow-brand-200"
            >
              Mở link Cổng TT
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6 max-w-sm mx-auto">
          <p className="text-sm font-semibold text-slate-700">Thanh toán bằng Tiền mặt</p>
          <p className="text-xs text-slate-500 mt-1">Lễ tân thu tiền mặt trực tiếp tại quầy.</p>
        </div>
      )}

      <div className="pt-6">
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          Hoàn thành & Quay lại danh sách
        </button>
      </div>
    </div>
  )
}
