import { useEffect, useRef, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning'
  duration?: number
  onClose: () => void
}

export default function Toast({ message, type = 'error', duration = 6000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      window.setTimeout(() => onCloseRef.current(), 300)
    }, duration)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [duration])

  const isErrorOrWarning = type === 'error' || type === 'warning' || message.includes('quá hạn') || message.includes('thất bại') || message.includes('không')

  const colorClass =
    type === 'success'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-emerald-200/50'
      : type === 'warning'
      ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-amber-200/60'
      : 'border-red-400 bg-red-50 text-red-950 shadow-red-200/60'

  function dismiss() {
    setVisible(false)
    window.setTimeout(() => onCloseRef.current(), 300)
  }

  return (
    <div
      className={`fixed left-1/2 top-8 z-[9999] flex -translate-x-1/2 items-center gap-4 rounded-2xl border-2 px-6 py-4 shadow-2xl transition-all duration-300 ${
        isErrorOrWarning ? 'w-[92%] max-w-xl text-base sm:text-lg font-bold' : 'max-w-md text-sm font-semibold'
      } ${colorClass} ${
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'
      }`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {(type === 'error' || message.includes('quá hạn')) && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 text-2xl font-extrabold shadow-inner">
          ⚠️
        </div>
      )}
      {type === 'warning' && !message.includes('quá hạn') && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 text-2xl font-extrabold shadow-inner">
          🔔
        </div>
      )}
      {type === 'success' && !message.includes('quá hạn') && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-xl font-bold shadow-inner">
          ✓
        </div>
      )}
      <div className="flex-1 leading-snug">
        {isErrorOrWarning && (
          <p className="text-xs uppercase tracking-wider text-red-700 font-black mb-0.5">
            {message.includes('quá hạn') ? 'Cảnh báo quá hạn' : 'Thông báo'}
          </p>
        )}
        <span className="break-words">{message}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/5 hover:bg-black/15 text-slate-700 font-bold transition"
        aria-label="Đóng thông báo"
      >
        <span aria-hidden="true" className="text-xl">×</span>
      </button>
    </div>
  )
}

