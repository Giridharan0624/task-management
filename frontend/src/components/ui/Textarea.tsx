import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hintId = hint || error ? `${textareaId}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          aria-describedby={hintId}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border bg-card px-3 py-2.5 text-sm text-foreground transition-colors resize-none',
            'placeholder:text-muted-foreground/70',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error
              ? 'border-destructive focus-visible:ring-destructive focus-visible:border-destructive'
              : 'border-border/70 hover:border-foreground/30',
            className,
          )}
          {...props}
        />
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
Textarea.displayName = 'Textarea'
