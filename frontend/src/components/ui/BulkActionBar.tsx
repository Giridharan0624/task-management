'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

interface BulkActionBarProps {
  count: number
  label?: string
  onClear: () => void
  children?: React.ReactNode
  className?: string
}

/**
 * Floating action bar that appears above the main content when a multi-select
 * session has any selected items. Use with useMultiSelect().
 */
export function BulkActionBar({
  count,
  label,
  onClear,
  children,
  className,
}: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        'sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-xl shadow-black/10 backdrop-blur-lg animate-fade-in-scale',
        className
      )}
      style={{ animationDuration: '0.2s' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold tabular-nums text-primary-foreground"
          aria-live="polite"
        >
          {count}
        </span>
        <span className="text-sm font-medium text-foreground">
          {label ?? (count === 1 ? 'selected' : 'selected')}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {children}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear selection"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  )
}
