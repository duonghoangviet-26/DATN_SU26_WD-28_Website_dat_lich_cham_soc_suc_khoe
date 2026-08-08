import React, { forwardRef, useId } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, required, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || `textarea-${generatedId.replace(/:/g, '')}`
    const errorId = `${textareaId}-error`
    const visibleLabel = label?.replace(/\s*\*\s*$/, '')

    return (
      <div className="w-full space-y-1.5 text-left">
        {visibleLabel && (
          <label htmlFor={textareaId} className="text-xs font-semibold text-slate-700">
            {visibleLabel}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? [describedBy, errorId].filter(Boolean).join(' ') : describedBy}
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
        {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
