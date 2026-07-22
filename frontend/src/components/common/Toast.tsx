import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'warning'
  duration?: number
  onClose: () => void
}

export default function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  const colorClass =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : type === 'warning'
      ? 'border-orange-200 bg-orange-50 text-orange-600'
      : 'border-red-200 bg-red-50 text-red-600'

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg transition-all duration-300 ${colorClass} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <span className="flex-1 leading-5">{message}</span>
      <button onClick={dismiss} className="mt-0.5 shrink-0 opacity-50 hover:opacity-80">
        ✕
      </button>
    </div>
  )
}
