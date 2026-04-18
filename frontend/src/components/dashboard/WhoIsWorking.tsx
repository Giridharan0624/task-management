'use client'

import Link from 'next/link'
import { Coffee, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { LiveDot } from '@/components/ui/LiveDot'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useLiveTick } from '@/lib/hooks/useLiveTick'
import { cn } from '@/lib/utils'

export function WhoIsWorking() {
  const { data } = useTodayAttendance()
  useLiveTick(60_000) // re-render once a minute so durations update

  const working = (data ?? []).filter((a) => a.status === 'SIGNED_IN')

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          {working.length > 0 ? (
            <LiveDot size="sm" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          )}
          <h3 className="text-sm font-bold text-foreground">Working now</h3>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {working.length}
          </span>
        </div>
        <Link
          href="/attendance"
          className="flex items-center gap-0.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          All attendance
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {working.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Coffee className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">No one clocked in</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Team members appear here the moment they start a session.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {working.slice(0, 8).map((a) => (
            <li
              key={a.userId}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <Avatar name={a.userName || a.userEmail} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {a.userName || a.userEmail}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.currentTask?.taskTitle ?? 'General work'}
                  {a.currentTask?.projectName && (
                    <span className="text-muted-foreground/60">
                      {' · '}
                      {a.currentTask.projectName}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600">
                {a.currentSignInAt && formatElapsed(a.currentSignInAt)}
              </span>
            </li>
          ))}
          {working.length > 8 && (
            <li className="bg-muted/30 px-5 py-2 text-center">
              <Link
                href="/attendance"
                className="text-xs font-semibold text-primary hover:underline"
              >
                +{working.length - 8} more working
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  )
}

function formatElapsed(signInAt: string): string {
  const ms = Date.now() - new Date(signInAt).getTime()
  const mins = Math.max(0, Math.floor(ms / 60_000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}
