import React, { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-lg border text-sm transition-all duration-200 outline-none
              ${icon ? 'pl-10' : 'pl-3.5'} pr-3.5 py-2.5
              ${
                error
                  ? 'border-red-300 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
              }
              placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
