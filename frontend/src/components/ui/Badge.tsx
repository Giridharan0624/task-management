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
  TODO: 'bg-slate-100 text-slate-700 border border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  LOW: 'bg-slate-50 text-slate-600 border border-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide',
        variant ? variantClasses[variant] : undefined,
        className
      )}
    >
      {children}
    </span>
  )
}
