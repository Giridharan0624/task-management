'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LiveDot } from './LiveDot'
import { useCountUp } from '@/lib/hooks/useCountUp'

export interface StatCardItem {
  key: string
  label: string
  value: number | string
  /** Tailwind text-color class for the big value, e.g. `text-indigo-700` */
  accent?: string
  /** When provided, the card becomes a filter button */
  onClick?: () => void
  selected?: boolean
  /** When provided, an optional icon renders above the value */
  icon?: React.ReactNode
  /** Optional live-pulse dot next to the value (e.g. "online now") */
  live?: boolean
}

interface StatCardsGridProps {
  items: StatCardItem[]
  className?: string
  /** Override default responsive column count */
  columns?: 3 | 4 | 5 | 6
}

const GRID_COLS: Record<NonNullable<StatCardsGridProps['columns']>, string> = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}

/**
 * Stat grid rendered as a single card with hairline-divided cells —
 * not a row of independent rounded tiles. Each cell shows: an optional
 * status dot, the metric label in tracked uppercase, and the value in
 * a medium-weight tabular numeral.
 *
 * Click-through cells become filter buttons; the selected one gets a
 * thin top accent rule + light surface tint, no shadow lift.
 *
 * Motion: numeric values still count up on mount (subtle, 800ms) but
 * the per-card stagger fade is gone — the strip lands as a single
 * data surface, not as a sequence of animations.
 */
export function StatCardsGrid({ items, className, columns }: StatCardsGridProps) {
  const cols =
    columns ?? (items.length >= 5 ? 5 : (items.length as 3 | 4))
  const gridCols =
    GRID_COLS[cols as keyof typeof GRID_COLS] ?? 'grid-cols-2 sm:grid-cols-4'

  return (
    <div
      className={cn(
        'grid divide-x divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card sm:divide-y-0',
        gridCols,
        className,
      )}
    >
      {items.map((item) => (
        <StatCard key={item.key} item={item} />
      ))}
    </div>
  )
}

function StatCard({ item }: { item: StatCardItem }) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        {item.live && <LiveDot size="xs" />}
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {item.label}
        </p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <StatValue value={item.value} accent={item.accent} />
      </div>
    </>
  )

  const baseClass = 'flex flex-col px-5 py-4 text-left transition-colors'

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={cn(
          baseClass,
          'focus:outline-none focus-visible:bg-muted/40',
          item.selected
            ? 'bg-primary/[0.04] shadow-[inset_0_2px_0_0_rgb(var(--color-primary))]'
            : 'hover:bg-muted/30',
        )}
      >
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}

/** Numeric values count up; strings render as-is. */
function StatValue({
  value,
  accent,
}: {
  value: number | string
  accent?: string
}) {
  const numeric = typeof value === 'number' ? value : null
  const animated = useCountUp(numeric ?? 0, {
    duration: 800,
    disabled: numeric === null,
  })
  return (
    <span
      className={cn(
        'text-2xl font-medium tabular-nums leading-none [font-feature-settings:\'tnum\',\'lnum\']',
        accent ?? 'text-foreground',
      )}
    >
      {numeric === null ? value : animated}
    </span>
  )
}
