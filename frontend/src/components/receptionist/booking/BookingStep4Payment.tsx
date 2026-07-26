import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { CreatedReceptionistBookingResult, ReceptionistPaymentStatusResult, receptionistBookingService } from '@/services/receptionist-booking.service'
import Button from '@/components/common/Button'

const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
const formatGatewayExpiry = (dateStr: string) => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('vi-VN')
}

export interface BookingStep4PaymentProps {
  createdBooking: CreatedReceptionistBookingResult | null
  paymentMethod: 'cash' | 'transfer'
  onDone: () => void
}

export default function BookingStep4Payment({
  createdBooking,
  paymentMethod,
  onDone,
}: BookingStep4PaymentProps) {
  const [paymentSnapshot, setPaymentSnapshot] = useState<ReceptionistPaymentStatusResult | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [countdownLabel, setCountdownLabel] = useState<string>('')

  // Lắng nghe tạo VNPAY Payment Session
  const [creatingPaymentSession, setCreatingPaymentSession] = useState(false)
  useEffect(() => {
    if (!createdBooking?.payment_id || paymentMethod === 'cash') return

    let ignore = false
    setCreatingPaymentSession(true)
    receptionistBookingService.createVnpaySession(createdBooking.payment_id)
      .then((data) => {
        if (!ignore) setPaymentSnapshot(data)
      })
      .catch((error: any) => {
        console.error("Lỗi tạo session VNPAY", error)
      })
      .finally(() => {
        if (!ignore) setCreatingPaymentSession(false)
      })

    return () => {
      ignore = true
    }
  }, [createdBooking?.payment_id])

  // Render QR Code từ payload
  useEffect(() => {
    if (!paymentSnapshot?.gateway?.qr_payload) {
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
        }
      })

    return () => {
      cancelled = true
    }
  }, [paymentSnapshot?.gateway?.qr_payload])

  // Polling trạng thái thanh toán
  useEffect(() => {
    if (!createdBooking?.payment_id || paymentSnapshot?.payment_status !== 'pending') return

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
  }, [createdBooking?.payment_id, paymentSnapshot?.payment_status])

  // Countdown timer
  useEffect(() => {
    if (!paymentSnapshot?.gateway?.expires_at) return
    const expiry = new Date(paymentSnapshot.gateway.expires_at).getTime()
    
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = expiry - now
      if (diff <= 0) {
        setCountdownLabel('Hết hạn')
        clearInterval(interval)
      } else {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diff % (1000 * 60)) / 1000)
        setCountdownLabel(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [paymentSnapshot?.gateway?.expires_at])

  const handleOpenVnpayPage = () => {
    if (paymentSnapshot?.gateway?.payment_url) {
      window.open(paymentSnapshot.gateway.payment_url, '_blank')
    }
  }

  const handleRefreshVnpaySession = async () => {
    if (!createdBooking?.payment_id) return
    setCreatingPaymentSession(true)
    try {
      const data = await receptionistBookingService.createVnpaySession(createdBooking.payment_id)
      setPaymentSnapshot(data)
    } catch (error: any) {
      console.error(error)
    } finally {
      setCreatingPaymentSession(false)
    }
  }

  const handleMockComplete = async () => {
    if (!createdBooking?.payment_id) return
    setCreatingPaymentSession(true)
    try {
      const data = await receptionistBookingService.completeMockVnpayPayment(createdBooking.payment_id)
      setPaymentSnapshot(data)
      // TODO: có thể gọi onDone() luôn hoặc thông báo thành công
    } catch (error: any) {
      console.error(error)
      const msg = error.response?.data?.message || 'Không thể mô phỏng thanh toán.'
      alert(msg) // Tạm dùng alert để dễ debug hoặc bạn có thể pass setToast prop
    } finally {
      setCreatingPaymentSession(false)
    }
  }

  if (!createdBooking) return null

  const isPaid = paymentMethod === 'cash' || paymentSnapshot?.appointment_payment_status === 'paid' || createdBooking.payment_status === 'paid'

  if (isPaid) {
    return (
      <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-slate-800">Đặt lịch và Thanh toán thành công!</h3>
          <p className="text-sm text-slate-500">
            {paymentMethod === 'cash'
              ? 'Lịch khám đã được tạo và ghi nhận thanh toán tiền mặt tại quầy.'
              : 'Giao dịch chuyển khoản qua VNPAY đã được xác nhận thành công.'}
          </p>
        </div>
        <div className="mx-auto max-w-sm space-y-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
          <p className="flex justify-between"><span className="font-semibold">Mã lịch hẹn:</span> <span>{createdBooking.appointment_id}</span></p>
          <p className="flex justify-between"><span className="font-semibold">Mã giao dịch:</span> <span>{createdBooking.ma_giao_dich}</span></p>
          <p className="flex justify-between"><span className="font-semibold">Số tiền thu:</span> <span className="font-bold text-slate-800">{formatCurrency(createdBooking.gia_kham)}</span></p>
        </div>
        <div className="pt-4">
          <Button onClick={onDone} className="bg-brand-600 hover:bg-brand-700 text-white min-w-[200px]">
            Hoàn tất & Về danh sách
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Thanh toán VNPAY</p>
        <h3 className="text-xl font-extrabold text-slate-800">Thanh toán qua mã QR</h3>
        <p className="text-sm text-slate-500">
          Hệ thống đã tạo lịch hẹn. Lễ tân có thể yêu cầu khách hàng quét mã QR VNPAY dưới đây để thanh toán, hoặc bấm mô phỏng thanh toán thành công.
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
      ) : paymentSnapshot && paymentSnapshot.gateway ? (
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
              <p><span className="font-semibold text-slate-500">Merchant:</span> {paymentSnapshot.gateway.merchant_name || 'ViteFamily'}</p>
              <p><span className="font-semibold text-slate-500">Mã merchant:</span> {paymentSnapshot.gateway.merchant_code || 'VITEFAMILY'}</p>
              <p><span className="font-semibold text-slate-500">Ngân hàng:</span> {paymentSnapshot.gateway.bank_code || 'VNBANK'}</p>
              <p><span className="font-semibold text-slate-500">Hạn thanh toán:</span> {formatGatewayExpiry(paymentSnapshot.gateway.expires_at)}</p>
              <p><span className="font-semibold text-slate-500">Trạng thái gateway:</span> {paymentSnapshot.gateway.mock_status || 'waiting_for_customer'}</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 shadow-sm">
              <p className="mb-3 font-semibold text-blue-900">Thông tin Thẻ Test (VNPAY Sandbox):</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-blue-600">Ngân hàng:</span>
                  <span className="font-medium">NCB</span>
                </div>
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-blue-600">Số thẻ:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold select-all">9704198526191432198</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-blue-600">Tên chủ thẻ:</span>
                  <span className="font-medium select-all">NGUYEN VAN A</span>
                </div>
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-blue-600">Ngày phát hành:</span>
                  <span className="font-medium">07/15</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-600">Mã OTP:</span>
                  <span className="font-medium">123456</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="secondary" onClick={handleOpenVnpayPage} disabled={!paymentSnapshot.gateway.payment_url}>
                Mở trang VNPAY
              </Button>
              <Button variant="secondary" onClick={handleRefreshVnpaySession} loading={creatingPaymentSession}>
                Tạo lại mã QR
              </Button>
              <Button onClick={handleMockComplete} loading={creatingPaymentSession} className="bg-blue-600 hover:bg-blue-700 text-white">
                Mô phỏng thanh toán thành công
              </Button>
              <Button variant="secondary" onClick={onDone}>
                Thanh toán sau (Về danh sách)
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
  )
}
