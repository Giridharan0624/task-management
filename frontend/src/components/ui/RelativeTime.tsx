'use client'

import { useEffect, useState } from 'react'
import {
  formatAbsoluteTime,
  formatRelativeTime,
} from '@/lib/utils/formatRelativeTime'
import { useUserTimezone } from '@/lib/hooks/useUserTimezone'
import { cn } from '@/lib/utils'

interface RelativeTimeProps {
  value: string | number | Date | null | undefined
  className?: string
  /** Re-compute every minute so the label stays fresh. Default: true */
  live?: boolean
}

/**
 * Renders a relative time label ("3m ago") with an absolute-time tooltip
 * on the underlying <time> element. Auto-refreshes each minute so labels
 * don't go stale in long-lived tabs.
 */
export function RelativeTime({
  value,
  className,
  live = true,
}: RelativeTimeProps) {
  const [tick, setTick] = useState(0)
  const { timezone } = useUserTimezone()

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [live])

  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null

  // Reference `tick` so React re-renders on the minute.
  void tick

  return (
    <time
      dateTime={d.toISOString()}
      title={formatAbsoluteTime(d, timezone)}
      className={cn('tabular-nums', className)}
    >
      {formatRelativeTime(d)}
    </time>
  )
}
