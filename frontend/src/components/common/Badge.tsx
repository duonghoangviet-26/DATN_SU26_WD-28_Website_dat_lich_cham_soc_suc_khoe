import type { ReactNode } from 'react'

type Color = 'green' | 'red' | 'blue' | 'yellow' | 'gray'

interface Props {
  color?: Color
  children: ReactNode
}

const colorMap: Record<Color, string> = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray: 'bg-slate-100 text-slate-600',
}

export default function Badge({ color = 'gray', children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[color]}`}
    >
      {children}
    </span>
  )
}
