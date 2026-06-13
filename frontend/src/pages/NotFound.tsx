import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-100">
        <svg className="h-12 w-12 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      </div>
      <div>
        <p className="text-7xl font-black text-brand-500">404</p>
        <p className="mt-2 text-lg font-semibold text-slate-700">Không tìm thấy trang</p>
        <p className="mt-1 text-sm text-slate-500">Trang bạn yêu cầu không tồn tại hoặc đã bị xóa.</p>
      </div>
      <Link to="/" className="btn-primary px-6">
        Về trang chủ
      </Link>
    </div>
  )
}
