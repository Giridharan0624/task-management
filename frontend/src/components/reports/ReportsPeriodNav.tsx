'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type Period = 'daily' | 'weekly' | 'monthly'

interface ReportsPeriodNavProps {
  period: Period
  onPeriodChange: (p: Period) => void
  offset: number
  onOffsetChange: (o: number) => void
  label: string
  /** Hide the period selector and show only the prev/label/next navigator. */
  hidePeriodPicker?: boolean
}

export function ReportsPeriodNav({
  period,
  onPeriodChange,
  offset,
  onOffsetChange,
  label,
  hidePeriodPicker = false,
}: ReportsPeriodNavProps) {
  const canGoForward = offset < 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {!hidePeriodPicker ? (
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPeriodChange(p)
                onOffsetChange(0)
              }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                period === p
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOffsetChange(offset - 1)}
          className="h-8 w-8"
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[200px] text-center text-sm font-semibold text-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOffsetChange(offset + 1)}
          disabled={!canGoForward}
          className="h-8 w-8"
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {offset !== 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onOffsetChange(0)}
            className="h-auto"
          >
            Jump to current
          </Button>
        )}
      </div>
    </div>
  )
}
