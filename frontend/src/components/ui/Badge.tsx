import clsx from 'clsx'
import type { TaskStatus, TaskPriority } from '@/types/task'

type BadgeVariant = TaskStatus | TaskPriority

interface BadgeWithVariantProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

interface BadgeWithoutVariantProps {
  variant?: undefined
  children: React.ReactNode
  className?: string
}

type BadgeProps = BadgeWithVariantProps | BadgeWithoutVariantProps

const variantClasses: Record<BadgeVariant, string> = {
  TODO: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        variant ? variantClasses[variant] : undefined,
        className
      )}
    >
      {children}
    </span>
  )
}
