'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * Non-blocking banner shown whenever the current org is in
 * PENDING_DELETION state. Unlike SuspendedScreen this doesn't take
 * over the app — the owner still needs to reach
 * /settings/delete-workspace to recover or export, and other users
 * deserve to know their data is on the clock.
 *
 * The backend's `require_not_suspended` helper already blocks every
 * mutation once PENDING_DELETION lands, so reads here are the only
 * allowed surface.
 */
interface PendingDeletionBannerProps {
  deletedAt: string
  isOwner: boolean
}

export function PendingDeletionBanner({
  deletedAt,
  isOwner,
}: PendingDeletionBannerProps) {
  const deleteDate = new Date(deletedAt)
  const purgeDate = new Date(deleteDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const daysRemaining = Math.max(
    0,
    Math.ceil((purgeDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  )

  return (
    <div className="sticky top-0 z-30 border-b border-destructive/30 bg-destructive/[0.06] px-4 py-2 text-xs backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">
            Workspace deletion scheduled — {daysRemaining} day
            {daysRemaining === 1 ? '' : 's'} remaining.
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            All writes are disabled. Permanent purge on{' '}
            {purgeDate.toLocaleDateString()}.
          </span>
        </div>
        {isOwner && (
          <Link
            href="/settings/delete-workspace"
            className="inline-flex items-center gap-1 font-semibold text-destructive hover:underline"
          >
            Manage
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}
