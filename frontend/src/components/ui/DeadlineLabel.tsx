'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseDeadline, isOverdue } from '@/lib/utils/deadline'
import { formatAbsoluteTime } from '@/lib/utils/formatRelativeTime'
import { useUserTimezone } from '@/lib/hooks/useUserTimezone'

interface DeadlineLabelProps {
  deadline: string | null | undefined
  /** Current task status — used to skip the overdue tone for DONE tasks. */
  status?: string
  /** Show the leading calendar icon. Default: false. */
  icon?: boolean
  /** Visual density — compact drops the verb ("Due in 2d" → "in 2d"). */
  compact?: boolean
  className?: string
}

/**
 * Deadline-idiomatic label: "Due today", "Due in 2d", "Overdue 3d", "Due Mar 28".
 * Self-refreshes every minute so bucket changes land without manual re-render.
 * If the date is > 2 weeks out we fall back to a calendar-style absolute label,
 * since "Due in 23d" isn't more useful than "Due Apr 14".
 */
export function DeadlineLabel({
  deadline,
  status,
  icon = false,
  compact = false,
  className,
}: DeadlineLabelProps) {
  const [tick, setTick] = useState(0)
  const { timezone } = useUserTimezone()

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!deadline) return null
  const d = parseDeadline(deadline)
  if (Number.isNaN(d.getTime())) return null
  void tick

  const overdue = isOverdue(deadline, status)
  const { label, tone } = buildLabel(d, overdue, status === 'DONE', compact)

  return (
    <span
      title={formatAbsoluteTime(d, timezone)}
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        tone,
        className
      )}
    >
      {icon && <CalendarClock className="h-3 w-3" />}
      {label}
    </span>
  )
}

function buildLabel(
  d: Date,
  overdue: boolean,
  done: boolean,
  compact: boolean
): { label: string; tone: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const daysDiff = Math.round(
    (dayOnly.getTime() - today.getTime()) / 86_400_000
  )

  if (done) {
    return {
      label: absoluteShort(d, false),
      tone: 'text-muted-foreground line-through decoration-muted-foreground/40',
    }
  }

  if (overdue) {
    const absDays = Math.abs(daysDiff)
    const label =
      absDays === 0
        ? 'Overdue today'
        : absDays === 1
          ? compact
            ? 'Overdue 1d'
            : 'Overdue 1d'
          : `Overdue ${absDays}d`
    return { label, tone: 'font-semibold text-destructive' }
  }

  if (daysDiff === 0)
    return {
      label: compact ? 'Today' : 'Due today',
      tone: 'font-semibold text-amber-600 dark:text-amber-400',
    }
  if (daysDiff === 1)
    return {
      label: compact ? 'Tomorrow' : 'Due tomorrow',
      tone: 'font-semibold text-amber-600 dark:text-amber-400',
    }
  if (daysDiff <= 7)
    return {
      label: compact ? `in ${daysDiff}d` : `Due in ${daysDiff}d`,
      tone: 'text-foreground/80',
    }
  if (daysDiff <= 14)
    return {
      label: compact ? `in ${daysDiff}d` : `Due in ${daysDiff}d`,
      tone: 'text-muted-foreground',
    }
  // Beyond 2 weeks, relative time loses usefulness — show the date.
  return {
    label: compact ? absoluteShort(d, false) : `Due ${absoluteShort(d, false)}`,
    tone: 'text-muted-foreground',
  }
}

function absoluteShort(d: Date, withYear: boolean): string {
  const now = new Date()
  const showYear = withYear || d.getFullYear() !== now.getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
  })
}
