import React, { forwardRef } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextareaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextareaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full rounded-lg border text-sm transition-all duration-200 outline-none
            px-3.5 py-2.5 min-h-[100px]
            ${
              error
                ? 'border-red-300 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-slate-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
            }
            placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
