'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Trophy, Medal } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { LiveDot } from '@/components/ui/LiveDot'
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
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (weeks.length === 0) return
    if (!weeks.some((w) => w.weekStart === activeWeek)) {
      setActiveWeek(weeks[weeks.length - 1].weekStart)
    }
  }, [weeks, activeWeek])

  const activeIndex = useMemo(
    () => weeks.findIndex((w) => w.weekStart === activeWeek),
    [weeks, activeWeek]
  )

  const current = activeIndex >= 0 ? weeks[activeIndex] : null

  const canGoPrev = activeIndex > 0
  const canGoNext = activeIndex >= 0 && activeIndex < weeks.length - 1

  const step = (by: number) => {
    const next = activeIndex + by
    if (next < 0 || next >= weeks.length) return
    setActiveWeek(weeks[next].weekStart)
  }

  if (weeks.length === 0) return null

  const entries = current
    ? [...current.entries].sort((a, b) => b.hours - a.hours)
    : []
  const weekTop = entries[0]?.hours ?? 0

  return (
    <Card className="overflow-hidden p-0">
      {/* Header is a full-width toggle — clicking anywhere on it expands
          or collapses the body. Chevron rotates 180° based on state as a
          visual cue; aria-expanded/controls wires screen-reader semantics. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="weekly-leaderboard-body"
        className={cn(
          'group flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:bg-muted/30',
          expanded && 'border-b border-border',
        )}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              !expanded && '-rotate-90',
            )}
            strokeWidth={2.2}
          />
          <h3 className="text-sm font-bold text-foreground">
            Weekly breakdown by member
          </h3>
        </div>
        {current && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {formatRange(current.weekStart, current.weekEnd)}
          </span>
        )}
      </button>

      {expanded && (
        <div id="weekly-leaderboard-body" className="animate-fade-in">
          {/* Week navigator — pill with prev / label / next, mirrors the
              AttendanceMonthNav shape so the two surfaces match visually. */}
          <div className="flex items-center justify-center border-b border-border px-3 py-2">
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => step(-1)}
                disabled={!canGoPrev}
                className="h-7 w-7"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[110px] px-2 text-center text-sm font-semibold tabular-nums text-foreground">
                {current ? shortLabel(current.weekStart) : ''}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => step(1)}
                disabled={!canGoNext}
                className="h-7 w-7"
                aria-label="Next week"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No hours logged this week"
                description="Nobody clocked in during this week."
                className="border-0 py-6"
              />
            </div>
          ) : (
            <>
              {/* Summary strip — team totals so the header communicates
                  the big picture before the eye drops into the list. */}
              <WeekSummary
                totalHours={entries.reduce((s, e) => s + e.hours, 0)}
                memberCount={entries.length}
                topEntry={entries[0]}
              />

              <div className="px-5 py-3 animate-fade-in">
                <div className="grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-border/60 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="text-center">Rank</span>
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
            </>
          )}
        </div>
      )}
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
  const isTop = rank === 1

  const baseClass =
    'grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-4 py-2.5 text-left transition-colors'

  const content = (
    <>
      <RankBadge rank={rank} />

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
              isTop && 'font-semibold',
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

      <span
        className={cn(
          'text-right tabular-nums text-foreground',
          isTop ? 'text-base font-bold' : 'text-sm font-semibold',
        )}
      >
        {formatDuration(entry.hours)}
      </span>

      <div className="flex w-[140px] items-center gap-2">
        <Progress
          value={pct}
          className={cn(
            'h-1.5 flex-1 overflow-hidden rounded-full',
            rank === 1 && '[&>div]:!bg-amber-500',
            rank === 2 && '[&>div]:!bg-slate-400',
            rank === 3 && '[&>div]:!bg-orange-500',
          )}
        />
        <span
          className={cn(
            'w-8 text-right text-[10px] tabular-nums',
            isTop ? 'font-bold text-foreground' : 'text-muted-foreground',
          )}
        >
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
          className={cn(
            baseClass,
            'group w-full cursor-pointer hover:bg-muted/40 -mx-5 px-5 pressable',
          )}
        >
          {content}
        </button>
      </li>
    )
  }
  return <li className={baseClass}>{content}</li>
}

/**
 * Medal / number tile for a rank column. Top-three get distinctive
 * colored tiles with Lucide Trophy / Medal icons; everyone else gets a
 * neutral muted tile so the #1/#2/#3 visual jumps out at a glance.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm ring-1 ring-amber-600/30"
        aria-label="1st place"
      >
        <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm ring-1 ring-slate-500/30"
        aria-label="2nd place"
      >
        <Medal className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-sm ring-1 ring-orange-600/30"
        aria-label="3rd place"
      >
        <Medal className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    )
  }
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold tabular-nums text-muted-foreground"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </div>
  )
}

/**
 * Team-totals strip shown above the leaderboard body. Gives the viewer
 * the big-picture number before they scan the per-member list.
 */
function WeekSummary({
  totalHours,
  memberCount,
  topEntry,
}: {
  totalHours: number
  memberCount: number
  topEntry: WeeklyLeaderboardEntry | undefined
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border bg-muted/20">
      <SummaryCell
        label="Total hours"
        value={formatDuration(totalHours)}
        tone="primary"
      />
      <SummaryCell
        label={memberCount === 1 ? 'Member' : 'Members'}
        value={String(memberCount)}
      />
      <SummaryCell
        label="Top performer"
        value={topEntry ? topEntry.name : '—'}
        accent
        truncate
      />
    </div>
  )
}

function SummaryCell({
  label,
  value,
  tone,
  accent,
  truncate,
}: {
  label: string
  value: string
  tone?: 'primary'
  accent?: boolean
  truncate?: boolean
}) {
  return (
    <div className="px-4 py-2.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums',
          tone === 'primary' && 'text-primary',
          accent && 'text-foreground',
          !tone && !accent && 'text-foreground',
          truncate && 'truncate',
        )}
      >
        {value}
      </p>
    </div>
  )
}
