import { useEffect, useState } from 'react'

export function useUpdatePulse(pulseKey = 0) {
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (pulseKey <= 0) return
    setPulsing(false)
    const frame = window.requestAnimationFrame(() => setPulsing(true))
    const timeout = window.setTimeout(() => setPulsing(false), 1000)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [pulseKey])

  return pulsing
}
