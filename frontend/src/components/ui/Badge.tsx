import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_COLORS } from '@/types/task'

// Refined badge: medium weight (was bold), subtle tracking (was wide),
// no ring (was 1px inset ring on every variant). Reads as a label, not
// a sticker. Same dimensions/sizing API so callers don't need updates.
const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors',
  {
    variants: {
      tone: {
        default: 'bg-muted/60 text-muted-foreground',
        primary: 'bg-primary/10 text-primary',
        success:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300',
        warning:
          'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200',
        danger:
          'bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300',
        info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300',
        neutral:
          'bg-slate-50 text-slate-600 dark:bg-slate-500/12 dark:text-slate-300',
        outline: 'border border-border text-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-0.5 text-[11px]',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      tone: 'default',
      size: 'md',
    },
  },
)

type BadgeVariantKey = TaskStatus | TaskPriority

interface BadgeWithVariantProps
  extends Omit<VariantProps<typeof badgeVariants>, 'tone'> {
  variant: BadgeVariantKey
  tone?: undefined
  children: React.ReactNode
  className?: string
}

interface BadgeWithToneProps
  extends VariantProps<typeof badgeVariants> {
  variant?: undefined
  children: React.ReactNode
  className?: string
}

type BadgeProps = BadgeWithVariantProps | BadgeWithToneProps

const priorityClasses: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25',
  MEDIUM:
    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25',
}

const legacyClasses: Record<string, string> = {
  ...TASK_STATUS_COLORS,
  ...priorityClasses,
}

export function Badge({
  variant,
  tone,
  size,
  children,
  className,
}: BadgeProps) {
  const legacy = variant ? legacyClasses[variant] : undefined
  return (
    <span
      className={cn(
        legacy
          ? cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]',
              legacy,
            )
          : badgeVariants({ tone, size }),
        className,
      )}
    >
      {children}
    </span>
  )
}

export { badgeVariants }
