import type { ReactNode } from 'react'

type MotionBlockProps = {
  children: ReactNode
  className?: string
}

export function AdminMotionGroup({ children, className = '' }: MotionBlockProps) {
  return <div className={className}>{children}</div>
}

export function AdminMotionItem({ children, className = '' }: MotionBlockProps) {
  return <div className={className}>{children}</div>
}

export function AdminAutoStagger({ children, className = '' }: MotionBlockProps) {
  return <div className={className}>{children}</div>
}
