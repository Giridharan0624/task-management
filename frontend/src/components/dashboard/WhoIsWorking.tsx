'use client'

import Link from 'next/link'
import { Coffee, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { LiveDot } from '@/components/ui/LiveDot'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useLiveTick } from '@/lib/hooks/useLiveTick'

export function WhoIsWorking() {
  const { data } = useTodayAttendance()
  useLiveTick(60_000) // re-render once a minute so durations update

  const working = (data ?? []).filter((a) => a.status === 'SIGNED_IN')

  return (
    <Card className="flex flex-col overflow-hidden p-0 shadow-none">
      <div className="flex items-baseline justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2">
          {working.length > 0 ? (
            <LiveDot size="sm" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          )}
          <h3 className="text-sm font-medium text-foreground">Working now</h3>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {working.length}
          </span>
        </div>
        <Link
          href="/attendance"
          className="group inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          All attendance
          <ArrowUpRight
            className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      {working.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Coffee
            className="h-5 w-5 text-muted-foreground/70"
            strokeWidth={1.4}
          />
          <p className="text-sm font-medium text-foreground">
            No one clocked in
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Team members appear here the moment they start a session.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {working.slice(0, 8).map((a) => (
            <li
              key={a.userId}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <Avatar name={a.userName || a.userEmail} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
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
              <span className="shrink-0 text-xs font-medium tabular-nums text-emerald-700">
                {a.currentSignInAt && formatElapsed(a.currentSignInAt)}
              </span>
            </li>
          ))}
          {working.length > 8 && (
            <li className="bg-muted/20 px-5 py-2 text-center">
              <Link
                href="/attendance"
                className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
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
