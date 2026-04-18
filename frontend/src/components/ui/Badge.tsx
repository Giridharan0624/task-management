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
        success:
          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
        warning:
          'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        danger:
          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
        neutral:
          'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
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
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
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
