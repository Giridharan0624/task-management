'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LiveDot } from './LiveDot'

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
 * Big-card stat grid. Values render large and colored; labels are small and
 * uppercase. Cards become clickable filters when `onClick` is set, with a
 * distinct `selected` state (accent border + tinted background).
 */
export function StatCardsGrid({ items, className, columns }: StatCardsGridProps) {
  const cols =
    columns ?? (items.length >= 5 ? 5 : (items.length as 3 | 4))
  return (
    <div
      className={cn(
        'grid gap-3',
        GRID_COLS[cols as keyof typeof GRID_COLS] ?? 'grid-cols-2 sm:grid-cols-4',
        className
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
      {item.icon && (
        <div className="mb-2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
          {item.icon}
        </div>
      )}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold tracking-tight tabular-nums',
            item.accent ?? 'text-foreground'
          )}
        >
          {item.value}
        </span>
        {item.live && <LiveDot size="xs" />}
      </div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {item.label}
      </p>
    </>
  )

  const baseClass =
    'rounded-xl border bg-card p-4 shadow-card text-left transition-all'

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={cn(
          baseClass,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          item.selected
            ? 'border-primary/40 bg-primary/5 shadow-card-hover'
            : 'border-border hover:border-border/80 hover:shadow-card-hover'
        )}
      >
        {content}
      </button>
    )
  }

  return <div className={cn(baseClass, 'border-border')}>{content}</div>
}
