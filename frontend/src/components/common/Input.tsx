import React, { forwardRef, useId } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, required, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || `input-${generatedId.replace(/:/g, '')}`
    const errorId = `${inputId}-error`
    const visibleLabel = label?.replace(/\s*\*\s*$/, '')

    return (
      <div className="w-full space-y-1.5 text-left">
        {visibleLabel && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
            {visibleLabel}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
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
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? [describedBy, errorId].filter(Boolean).join(' ') : describedBy}
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
        {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
