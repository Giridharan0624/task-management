'use client'

import { FileClock, X } from 'lucide-react'
import { Button } from './Button'
import { formatRelativeTime } from '@/lib/utils/formatRelativeTime'
import { cn } from '@/lib/utils'

interface DraftRestoreBannerProps {
  savedAt: number
  onRestore: () => void
  onDismiss: () => void
  className?: string
  /** Short label — e.g. "daily update". */
  entityLabel?: string
}

/**
 * Inline banner shown at the top of a form when a locally-saved draft is
 * available to restore. Neutral tone — pairs with useAutosaveDraft().
 */
export function DraftRestoreBanner({
  savedAt,
  onRestore,
  onDismiss,
  className,
  entityLabel = 'draft',
}: DraftRestoreBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm animate-fade-in',
        className
      )}
    >
      <FileClock className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">
          You have an unsaved {entityLabel}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Saved {formatRelativeTime(savedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="primary" size="sm" onClick={onRestore}>
          Restore
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss draft"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
