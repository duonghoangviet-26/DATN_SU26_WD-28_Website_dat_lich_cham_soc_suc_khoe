import React from 'react'

interface EmptyProps {
  title?: string
  description?: string
  icon?: 'search' | 'calendar' | 'box'
}

export default function Empty({
  title = 'Không tìm thấy dữ liệu',
  description = 'Vui lòng thay đổi từ khóa tìm kiếm hoặc quay lại sau.',
  icon = 'box',
}: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Dynamic medical-themed Empty SVGs */}
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        {icon === 'search' && (
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        {icon === 'calendar' && (
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        {icon === 'box' && (
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-sm">{description}</p>
    </div>
  )
}
