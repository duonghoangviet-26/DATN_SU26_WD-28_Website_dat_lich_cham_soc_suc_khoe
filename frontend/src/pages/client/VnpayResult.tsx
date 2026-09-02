import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Breadcrumb from '@/components/common/Breadcrumb'
import { useAuth } from '@/context/AuthContext'
import { patientRecordsService, type PatientRecordDetail } from '@/services/patient-records.service'

function getFailureMessage(reason: string | null) {
  if (reason === 'checksum') return 'Chữ ký giao dịch không hợp lệ. Vui lòng liên hệ phòng khám để được kiểm tra.'
  if (reason === 'not_found') return 'Không tìm thấy giao dịch thanh toán từ VNPAY.'
  if (reason === 'payment_failed') return 'VNPAY chưa ghi nhận giao dịch thành công.'
  if (reason === 'server_error') return 'Hệ thống đang gặp lỗi khi xác nhận thanh toán.'
  return 'Giao dịch chưa được xác nhận thành công.'
}

function formatCurrency(value?: number | null) {
  return typeof value === 'number' ? `${value.toLocaleString('vi-VN')}đ` : 'Đang cập nhật'
}

function formatAppointmentDate(value?: string | null) {
  if (!value) return 'Đang cập nhật ngày khám'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function DetailIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
      {children}
    </span>
  )
}

export default function VnpayResult() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [appointment, setAppointment] = useState<PatientRecordDetail | null>(null)
  const [loadingAppointment, setLoadingAppointment] = useState(false)
  const [appointmentError, setAppointmentError] = useState(false)

  const paymentStatus = searchParams.get('payment_status')
  const appointmentId = searchParams.get('appointment_id') || searchParams.get('id') || ''
  const paymentId = searchParams.get('payment_id') || ''
  const reason = searchParams.get('reason')
  const isSuccess = paymentStatus === 'success'
  const profileSearch = appointmentId ? `?booked=true&id=${appointmentId}` : '?booked=true'
  const profileTarget = `/profile${profileSearch}`

  useEffect(() => {
    if (!isSuccess || !user || !appointmentId) return

    let ignore = false
    setLoadingAppointment(true)
    setAppointmentError(false)
    patientRecordsService.getAppointmentDetail(appointmentId)
      .then((data) => {
        if (!ignore) setAppointment(data)
      })
      .catch(() => {
        if (!ignore) setAppointmentError(true)
      })
      .finally(() => {
        if (!ignore) setLoadingAppointment(false)
      })

    return () => {
      ignore = true
    }
  }, [appointmentId, isSuccess, user])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <Breadcrumb items={[{ label: 'Kết quả thanh toán' }]} />

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className={`border-b px-6 py-7 sm:px-8 sm:py-8 ${isSuccess ? 'border-emerald-100 bg-emerald-50/80' : 'border-red-100 bg-red-50'}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 bg-white ${
                isSuccess ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-600'
              }`}
              aria-hidden="true"
            >
              {isSuccess ? (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <div>
              <p className={`text-sm font-bold ${isSuccess ? 'text-emerald-700' : 'text-red-700'}`}>
                {isSuccess ? 'VNPAY đã xác nhận giao dịch' : 'Giao dịch VNPAY chưa hoàn tất'}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl" style={{ textWrap: 'balance' }}>
                {isSuccess ? 'Thanh toán thành công' : 'Thanh toán chưa thành công'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                {isSuccess
                  ? 'Lịch khám của bạn đã được xác nhận. Vui lòng lưu lại thông tin ca khám bên dưới.'
                  : getFailureMessage(reason)}
              </p>
            </div>
          </div>
        </header>

        {isSuccess && loadingAppointment && (
          <div className="space-y-5 p-6 sm:p-8" aria-label="Đang tải chi tiết lịch khám">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        )}

        {isSuccess && !loadingAppointment && appointment && (
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Ca khám đã đặt</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">{appointment.ten_dich_vu || 'Khám chuyên khoa'}</h2>
              </div>
              <div className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">
                Đã thanh toán
              </div>
            </div>

            <dl className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex gap-3 py-5 sm:pr-6">
                <DetailIcon>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="4.5" width="18" height="16" rx="2" />
                    <path strokeLinecap="round" d="M7 2.5v4M17 2.5v4M7 10h10M7 14h4" />
                  </svg>
                </DetailIcon>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Thời gian khám</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">{appointment.gio_kham || 'Đang cập nhật'}</dd>
                  <dd className="mt-0.5 text-sm text-slate-600">{formatAppointmentDate(appointment.ngay_kham)}</dd>
                </div>
              </div>

              <div className="flex gap-3 py-5 sm:pl-6">
                <DetailIcon>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a8.5 8.5 0 008.5-8.5c0-4.694-3.806-8.5-8.5-8.5s-8.5 3.806-8.5 8.5A8.5 8.5 0 0012 21z" />
                    <path strokeLinecap="round" d="M9.5 12.5h5M12 10v5" />
                  </svg>
                </DetailIcon>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Bác sĩ phụ trách</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">{appointment.bac_si?.ho_ten || 'Đang phân công'}</dd>
                  <dd className="mt-0.5 text-sm text-slate-600">{appointment.ten_dich_vu || 'Chuyên khoa'}</dd>
                </div>
              </div>

              <div className="flex gap-3 py-5 sm:border-t sm:border-slate-100 sm:pr-6">
                <DetailIcon>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.236 6-11a6 6 0 10-12 0c0 5.764 6 11 6 11z" />
                    <circle cx="12" cy="10" r="2" />
                  </svg>
                </DetailIcon>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Địa điểm khám</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">{appointment.phong_kham || 'Phòng khám ViteFamily'}</dd>
                  <dd className="mt-0.5 text-sm text-slate-600">Vui lòng đến trước giờ hẹn 15 phút</dd>
                </div>
              </div>

              <div className="flex gap-3 py-5 sm:border-t sm:border-slate-100 sm:pl-6">
                <DetailIcon>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="8" r="3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21a6.5 6.5 0 0113 0" />
                  </svg>
                </DetailIcon>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Người khám</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">{appointment.ten_khach || user?.ho_ten || 'Bệnh nhân'}</dd>
                  <dd className="mt-0.5 text-sm text-slate-600">{appointment.so_dien_thoai_khach || user?.so_dien_thoai || 'Số liên hệ chưa cập nhật'}</dd>
                </div>
              </div>
            </dl>

            <div className="mt-2 flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Tổng thanh toán</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatCurrency(appointment.gia_kham)}</p>
              </div>
              <p className="text-sm font-semibold text-emerald-700">Đã thanh toán qua VNPAY</p>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <p><span className="font-semibold text-slate-800">Mã lịch hẹn:</span> <span className="break-all font-mono text-xs">{appointmentId}</span></p>
              <p><span className="font-semibold text-slate-800">Mã giao dịch:</span> <span className="break-all font-mono text-xs">{paymentId || 'Đang cập nhật'}</span></p>
            </div>
          </div>
        )}

        {isSuccess && !loadingAppointment && !appointment && (
          <div className="p-6 sm:p-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              {appointmentError
                ? 'Giao dịch đã thành công, nhưng hệ thống chưa tải được chi tiết ca khám. Bạn có thể xem đầy đủ thông tin trong hồ sơ.'
                : 'Vui lòng đăng nhập để xem đầy đủ thông tin ca khám vừa đặt.'}
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <p><span className="font-semibold text-slate-800">Mã lịch hẹn:</span> <span className="break-all font-mono text-xs">{appointmentId || 'Chưa có dữ liệu'}</span></p>
              <p><span className="font-semibold text-slate-800">Mã giao dịch:</span> <span className="break-all font-mono text-xs">{paymentId || 'Chưa có dữ liệu'}</span></p>
            </div>
          </div>
        )}

        {!isSuccess && (
          <div className="grid gap-3 p-6 text-sm text-slate-600 sm:grid-cols-2 sm:p-8">
            <p><span className="font-semibold text-slate-800">Mã lịch hẹn:</span> <span className="break-all font-mono text-xs">{appointmentId || 'Chưa có dữ liệu'}</span></p>
            <p><span className="font-semibold text-slate-800">Mã giao dịch:</span> <span className="break-all font-mono text-xs">{paymentId || 'Chưa có dữ liệu'}</span></p>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          {isSuccess ? (
            user ? (
              <Link to={profileTarget} className="btn-primary px-5 py-3 text-center text-sm font-bold">
                Xem lịch hẹn trong hồ sơ
              </Link>
            ) : (
              <Link to="/login" state={{ from: { pathname: '/profile', search: profileSearch } }} className="btn-primary px-5 py-3 text-center text-sm font-bold">
                Đăng nhập để xem hồ sơ
              </Link>
            )
          ) : (
            <Link to="/booking" className="btn-primary px-5 py-3 text-center text-sm font-bold">
              Đặt lịch mới
            </Link>
          )}
          <Link to="/" className="btn-secondary px-5 py-3 text-center text-sm font-bold">
            Về trang chủ
          </Link>
        </footer>
      </section>
    </div>
  )
}
