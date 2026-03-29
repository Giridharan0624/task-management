import React from 'react'
import clsx from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'block w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-200',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
            'hover:border-gray-300',
            error
              ? 'border-red-300 bg-red-50/50 focus:ring-red-500/40 focus:border-red-400'
              : 'border-gray-200 bg-white',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
