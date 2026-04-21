import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_COLORS } from '@/types/task'

const badgeVariants = cva(
  'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase transition-colors',
  {
    variants: {
      tone: {
        default: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
        primary:
          'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
        // Dark-mode variants pair a 15% saturated tint background with a
        // lightened foreground, which keeps contrast above WCAG AA on both
        // the dark sidebar + dark card surfaces.
        success:
          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
        warning:
          'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
        danger:
          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25',
        neutral:
          'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25',
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
  }
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
              'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
              legacy
            )
          : badgeVariants({ tone, size }),
        className
      )}
    >
      {children}
    </span>
  )
}

export { badgeVariants }
