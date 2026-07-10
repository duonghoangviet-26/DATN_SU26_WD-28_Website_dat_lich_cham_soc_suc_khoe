import React from 'react'

interface LoadingProps {
  fullPage?: boolean
  message?: string
}

export default function Loading({
  fullPage = false,
  message = 'Đang tải dữ liệu y tế...',
}: LoadingProps) {
  const containerStyle = fullPage
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/85 backdrop-blur-[1px]'
    : 'flex flex-col items-center justify-center py-12 px-4'

  return (
    <div className={containerStyle}>
      <div className="relative flex items-center justify-center">
        {/* Medical blue loading spinner */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        <div className="absolute grid h-5 w-5 place-items-center">
          <svg className="h-3 w-3 text-brand-600 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
          </svg>
        </div>
      </div>
      {message && <p className="mt-4 text-xs font-semibold text-slate-500">{message}</p>}
    </div>
  )
}
