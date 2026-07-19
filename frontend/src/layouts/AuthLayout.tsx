import { Outlet } from 'react-router-dom'

const features = [
  'Đặt lịch khám online nhanh chóng',
  'Quản lý hồ sơ y tế cả gia đình',
  'Nhắc nhở uống thuốc tự động',
  'Kết nối hàng trăm bác sĩ chuyên khoa',
]

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel — ẩn trên mobile */}
      <div className="hidden w-[45%] flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-10 lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white">ViteFamily</span>
        </div>

        {/* Tagline */}
        <div>
          <h2 className="text-3xl font-bold leading-snug text-white">
            Chăm sóc sức khỏe<br />cả gia đình bạn
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-100">
            Một tài khoản để quản lý sức khỏe cho mọi thành viên trong gia đình.
          </p>

          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-brand-100">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-brand-200">© 2026 ViteFamily · DATN SU26 WD-28</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 sm:p-10">
        {/* Mobile-only logo */}
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 shadow-lg shadow-brand-200">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-800">ViteFamily</span>
        </div>

        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
