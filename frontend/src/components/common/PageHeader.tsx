import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export default function PageHeader({ title, description, children, className = '' }: Props) {
  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
