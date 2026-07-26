import { Link, useSearchParams } from 'react-router-dom'

import Breadcrumb from '@/components/common/Breadcrumb'
import { useAuth } from '@/context/AuthContext'

function getFailureMessage(reason: string | null) {
  if (reason === 'checksum') return 'Chu ky giao dich khong hop le. Vui long lien he phong kham de kiem tra.'
  if (reason === 'not_found') return 'Khong tim thay giao dich thanh toan tu VNPay.'
  if (reason === 'payment_failed') return 'VNPay chua ghi nhan giao dich thanh cong.'
  if (reason === 'server_error') return 'He thong dang gap loi khi xac nhan thanh toan.'
  return 'Giao dich chua duoc xac nhan thanh cong.'
}

export default function VnpayResult() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const paymentStatus = searchParams.get('payment_status')
  const appointmentId = searchParams.get('appointment_id') || searchParams.get('id') || ''
  const paymentId = searchParams.get('payment_id') || ''
  const reason = searchParams.get('reason')
  const isSuccess = paymentStatus === 'success'
  const profileSearch = appointmentId ? `?booked=true&id=${appointmentId}` : '?booked=true'
  const profileTarget = `/profile${profileSearch}`

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <Breadcrumb items={[{ label: 'Ket qua thanh toan' }]} />

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className={`px-6 py-8 sm:px-8 ${isSuccess ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-3xl font-black ${
                isSuccess
                  ? 'border-emerald-200 bg-white text-emerald-600'
                  : 'border-red-200 bg-white text-red-600'
              }`}
              aria-hidden="true"
            >
              {isSuccess ? (
                <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <p className={`text-sm font-extrabold uppercase tracking-wider ${isSuccess ? 'text-emerald-700' : 'text-red-700'}`}>
                Thanh toan VNPay
              </p>
              <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">
                {isSuccess ? 'Thanh toan thanh cong' : 'Thanh toan chua thanh cong'}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                {isSuccess
                  ? 'Lich hen cua ban da duoc xac nhan va trang thai thanh toan da cap nhat thanh da thanh toan.'
                  : getFailureMessage(reason)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-100 p-6 sm:grid-cols-2 sm:p-8">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ma lich hen</p>
            <p className="mt-2 break-all text-sm font-extrabold text-slate-800">
              {appointmentId || 'Chua co du lieu'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ma thanh toan</p>
            <p className="mt-2 break-all text-sm font-extrabold text-slate-800">
              {paymentId || 'Chua co du lieu'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          {isSuccess ? (
            user ? (
              <Link to={profileTarget} className="btn-primary rounded-lg px-5 py-3 text-center text-sm font-bold">
                Xem lich hen trong ho so
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: '/profile', search: profileSearch } }}
                className="btn-primary rounded-lg px-5 py-3 text-center text-sm font-bold"
              >
                Dang nhap de xem ho so
              </Link>
            )
          ) : (
            <Link to="/booking" className="btn-primary rounded-lg px-5 py-3 text-center text-sm font-bold">
              Tao lich hen moi
            </Link>
          )}
          <Link to="/" className="btn-secondary rounded-lg px-5 py-3 text-center text-sm font-bold">
            Ve trang chu
          </Link>
        </div>
      </section>
    </div>
  )
}
