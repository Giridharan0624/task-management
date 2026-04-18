'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'

interface AttendanceMonthNavProps {
  year: number
  month: number // 1-12
  onChange: (year: number, month: number) => void
}

/**
 * Prev / next + month & year selects. Clamps to the current month so
 * users can't jump into the future. "Jump to current" link appears when
 * the user has navigated away from the current month.
 */
export function AttendanceMonthNav({
  year,
  month,
  onChange,
}: AttendanceMonthNavProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const canGoForward =
    year < currentYear || (year === currentYear && month < currentMonth)
  const isCurrent = year === currentYear && month === currentMonth

  const label = useMemo(
    () =>
      new Date(year, month - 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [year, month]
  )

  const shift = (by: number) => {
    const d = new Date(year, month - 1 + by, 1)
    onChange(d.getFullYear(), d.getMonth() + 1)
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
  }))

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(
    (y) => ({ value: String(y), label: String(y) })
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(-1)}
          className="h-7 w-7"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[120px] px-2 text-center text-sm font-semibold text-foreground tabular-nums">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="h-7 w-7"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Select
        value={String(month)}
        onChange={(v) => onChange(year, Number(v))}
        options={months}
        className="h-9 w-32"
      />
      <Select
        value={String(year)}
        onChange={(v) => onChange(Number(v), month)}
        options={years}
        className="h-9 w-24"
      />

      {!isCurrent && (
        <Button
          variant="link"
          size="sm"
          onClick={() => onChange(currentYear, currentMonth)}
          className="h-auto"
        >
          Jump to current
        </Button>
      )}
    </div>
  )
}
