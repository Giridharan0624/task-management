import React from 'react'
import clsx from 'clsx'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500 disabled:bg-indigo-300 shadow-sm hover:shadow-md hover:shadow-indigo-500/10',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 focus-visible:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 shadow-sm',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300 shadow-sm hover:shadow-md hover:shadow-red-500/10',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 focus-visible:ring-indigo-500 disabled:text-gray-400',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-all duration-200 active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
