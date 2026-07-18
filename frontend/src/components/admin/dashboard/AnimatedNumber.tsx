import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({
  value,
  format = (next) => String(Math.round(next)),
  duration = 500,
}: {
  value: number
  format?: (value: number) => string
  duration?: number
}) {
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      displayedRef.current = value
      setDisplayed(value)
      return
    }

    const startValue = displayedRef.current
    const startedAt = performance.now()
    let frame = 0

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = startValue + (value - startValue) * eased
      displayedRef.current = next
      setDisplayed(next)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, value])

  return <>{format(displayed)}</>
}
