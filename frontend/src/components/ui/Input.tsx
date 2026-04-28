import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hintId = hint || error ? `${inputId}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none [&>svg]:h-3.5 [&>svg]:w-3.5">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={hintId}
            className={cn(
              'flex h-10 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-colors',
              'placeholder:text-muted-foreground/70',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error
                ? 'border-destructive focus-visible:ring-destructive focus-visible:border-destructive'
                : 'border-border/70 hover:border-foreground/30',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={hintId}
            className="text-xs font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
