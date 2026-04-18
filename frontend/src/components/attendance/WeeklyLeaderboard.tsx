'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Progress } from '@/components/ui/Progress'
import { LiveDot } from '@/components/ui/LiveDot'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/utils/formatDuration'
import { cn } from '@/lib/utils'

export interface WeeklyLeaderboardEntry {
  userId: string
  name: string
  email: string
  avatarUrl?: string
  role: string
  hours: number
  days: number
  sessions: number
  isActive: boolean
}

export interface WeekLeaderboard {
  weekStart: string // YYYY-MM-DD (Monday)
  weekEnd: string // YYYY-MM-DD (Sunday)
  entries: WeeklyLeaderboardEntry[]
}

interface WeeklyLeaderboardProps {
  weeks: WeekLeaderboard[]
  onMemberClick?: (userId: string) => void
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function shortLabel(start: string): string {
  const s = new Date(start + 'T00:00:00')
  return `Wk of ${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export function WeeklyLeaderboard({
  weeks,
  onMemberClick,
}: WeeklyLeaderboardProps) {
  const [activeWeek, setActiveWeek] = useState<string>(() =>
    weeks.length > 0 ? weeks[weeks.length - 1].weekStart : ''
  )

  useEffect(() => {
    if (weeks.length === 0) return
    if (!weeks.some((w) => w.weekStart === activeWeek)) {
      setActiveWeek(weeks[weeks.length - 1].weekStart)
    }
  }, [weeks, activeWeek])

  const current = useMemo(
    () => weeks.find((w) => w.weekStart === activeWeek) ?? null,
    [weeks, activeWeek]
  )

  if (weeks.length === 0) return null

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-bold text-foreground">
          Weekly breakdown by member
        </h3>
        {current && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {formatRange(current.weekStart, current.weekEnd)}
          </span>
        )}
      </div>

      <Tabs value={activeWeek} onValueChange={setActiveWeek}>
        <div className="overflow-x-auto border-b border-border px-3 py-2">
          <TabsList className="h-8">
            {weeks.map((w) => (
              <TabsTrigger
                key={w.weekStart}
                value={w.weekStart}
                className="px-2.5 text-[11px]"
              >
                {shortLabel(w.weekStart)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {weeks.map((w) => {
          const entries = [...w.entries].sort((a, b) => b.hours - a.hours)
          const weekTop = entries[0]?.hours ?? 0
          return (
            <TabsContent key={w.weekStart} value={w.weekStart} className="mt-0">
              {entries.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No hours logged this week"
                    description="Nobody clocked in during this week."
                    className="border-0 py-6"
                  />
                </div>
              ) : (
                <div className="px-5 py-2">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-4 border-b border-border/60 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="w-6 text-right">#</span>
                    <span>Member</span>
                    <span className="text-right">Hours</span>
                    <span className="w-[140px]">Share</span>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {entries.map((e, i) => (
                      <LeaderboardRow
                        key={e.userId}
                        entry={e}
                        rank={i + 1}
                        topHours={weekTop}
                        onClick={
                          onMemberClick
                            ? () => onMemberClick(e.userId)
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </Card>
  )
}

function LeaderboardRow({
  entry,
  rank,
  topHours,
  onClick,
}: {
  entry: WeeklyLeaderboardEntry
  rank: number
  topHours: number
  onClick?: () => void
}) {
  const pct = topHours > 0 ? Math.round((entry.hours / topHours) * 100) : 0

  const baseClass =
    'grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-4 py-2.5 text-left transition-colors'

  const content = (
    <>
      <span className="w-6 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <Avatar url={entry.avatarUrl} name={entry.name} size="sm" />
          {entry.isActive && (
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
              <LiveDot size="xs" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-sm font-medium text-foreground',
              onClick && 'group-hover:text-primary'
            )}
          >
            {entry.name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {entry.days} day{entry.days === 1 ? '' : 's'} · {entry.sessions}{' '}
            session{entry.sessions === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <span className="text-right text-sm font-semibold tabular-nums text-foreground">
        {formatDuration(entry.hours)}
      </span>

      <div className="flex w-[140px] items-center gap-2">
        <Progress value={pct} className="h-1 flex-1" />
        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
    </>
  )

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className={cn(baseClass, 'group w-full cursor-pointer hover:bg-muted/40 -mx-5 px-5')}
        >
          {content}
        </button>
      </li>
    )
  }
  return <li className={baseClass}>{content}</li>
}
