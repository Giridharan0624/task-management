'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Palmtree } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { useAllDayOffs } from '@/lib/hooks/useDayOffs'
import { useUsers } from '@/lib/hooks/useUsers'
import { getLocalToday } from '@/lib/utils/date'

interface OnLeavePerson {
  userId: string
  userName: string
  avatarUrl?: string
  startDate: string
  endDate: string
  returnsOn: string // "today", "tomorrow", "Apr 24"
  daysRemaining: number
  reason: string
}

/**
 * Shows members whose APPROVED day-off range includes today, so an admin
 * scanning the dashboard sees who's out before they ping someone who can't
 * answer. Pairs with `<WhoIsWorking />` — one tells you who's in, the other
 * who's out.
 *
 * Hidden when there's no one on leave (rare to never-happen for small teams,
 * so we don't waste vertical space on a perpetual empty card).
 */
export function OnLeaveToday() {
  const { data: dayOffs } = useAllDayOffs()
  const { data: users } = useUsers()

  const today = getLocalToday()

  // Lookup avatars once; the all-dayoffs payload has names but not avatars.
  const avatarByUser = useMemo(() => {
    const m = new Map<string, string | undefined>()
    for (const u of users ?? []) m.set(u.userId, u.avatarUrl)
    return m
  }, [users])

  const onLeave: OnLeavePerson[] = useMemo(() => {
    const list = (dayOffs ?? [])
      .filter((d) => d.status === 'APPROVED')
      .filter((d) => {
        const start = d.startDate.slice(0, 10)
        const end = d.endDate.slice(0, 10)
        return start <= today && today <= end
      })
      .map((d) => {
        const endDay = d.endDate.slice(0, 10)
        const daysRemaining = daysBetween(today, endDay) // inclusive of today
        return {
          userId: d.userId,
          userName: d.userName,
          avatarUrl: avatarByUser.get(d.userId),
          startDate: d.startDate,
          endDate: d.endDate,
          returnsOn: describeReturn(endDay),
          daysRemaining,
          reason: d.reason,
        }
      })
      // If the same user has two approved overlapping entries (data quirk),
      // keep the one that ends latest — reflects the real return date.
      .sort((a, b) => b.endDate.localeCompare(a.endDate))
    const seen = new Set<string>()
    return list.filter((p) => {
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })
  }, [dayOffs, today, avatarByUser])

  if (onLeave.length === 0) {
    return (
      <Card className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <h3 className="text-sm font-bold text-foreground">On leave today</h3>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
              0
            </span>
          </div>
          <Link
            href="/day-offs"
            className="flex items-center gap-0.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            All day-offs
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Palmtree className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">Everyone&apos;s in today</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Approved day-offs that cover today will show up here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <h3 className="text-sm font-bold text-foreground">On leave today</h3>
          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {onLeave.length}
          </span>
        </div>
        <Link
          href="/day-offs"
          className="flex items-center gap-0.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          All day-offs
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="divide-y divide-border/60">
        {onLeave.slice(0, 8).map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
          >
            <Avatar url={p.avatarUrl} name={p.userName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {p.userName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.reason || 'Day off'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Back {p.returnsOn}
              </p>
              {p.daysRemaining > 1 && (
                <p className="text-[10px] font-medium text-muted-foreground">
                  {p.daysRemaining}d left
                </p>
              )}
            </div>
          </li>
        ))}
        {onLeave.length > 8 && (
          <li className="bg-muted/30 px-5 py-2 text-center">
            <Link
              href="/day-offs"
              className="text-xs font-semibold text-primary hover:underline"
            >
              +{onLeave.length - 8} more on leave
            </Link>
          </li>
        )}
      </ul>
    </Card>
  )
}

/** Whole-day count between two `YYYY-MM-DD` strings (inclusive of the end). */
function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000)) + 1
}

/** Render a return-date string that reads as naturally as possible. */
function describeReturn(endIso: string): string {
  const today = getLocalToday()
  const todayDate = new Date(today + 'T00:00:00')
  const endDate = new Date(endIso + 'T00:00:00')
  const dayAfterEnd = new Date(endDate.getTime() + 86_400_000)

  const daysUntilReturn = Math.round(
    (dayAfterEnd.getTime() - todayDate.getTime()) / 86_400_000
  )
  if (daysUntilReturn <= 1) return 'tomorrow'
  if (daysUntilReturn === 2) return 'in 2 days'

  return dayAfterEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
