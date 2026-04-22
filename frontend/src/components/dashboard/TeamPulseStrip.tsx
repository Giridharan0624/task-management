'use client'

import { useMemo } from 'react'
import {
  Users,
  Clock,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import {
  useTodayAttendance,
  useAttendanceReport,
  useMyAttendance,
} from '@/lib/hooks/useAttendance'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useProjects } from '@/lib/hooks/useProjects'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { cn } from '@/lib/utils'

type Trend = 'up' | 'down' | 'flat'

interface Metric {
  key: string
  label: string
  value: number | string
  icon: LucideIcon
  accent: string
  trend?: Trend
  trendLabel?: string
  live?: boolean
}

interface TeamPulseStripProps {
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export function TeamPulseStrip({ role }: TeamPulseStripProps) {
  const { data: todayAttendance } = useTodayAttendance()
  const { data: myTasks } = useMyTasks()
  const { data: users } = useUsers()
  const { data: projects } = useProjects()
  const { data: myAttendance } = useMyAttendance()

  // 7-day report for week-over-week trends (owner only)
  const dates = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 13) // 2 weeks back so we can diff
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }, [])
  const { data: report } = useAttendanceReport(dates.start, dates.end)

  const workingNow = (todayAttendance ?? []).filter(
    (a) => a.status === 'SIGNED_IN'
  ).length

  const hoursToday = (todayAttendance ?? []).reduce(
    (sum, a) =>
      sum +
      a.sessions.reduce(
        (s, se) =>
          s + (se.hours ?? computeLiveHours(se.signInAt, se.signOutAt)),
        0
      ),
    0
  )

  const completedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (myTasks ?? []).filter((t) => {
      if (t.status !== 'DONE') return false
      if (!t.updatedAt) return false
      return t.updatedAt.slice(0, 10) === today
    }).length
  }, [myTasks])

  const overdueCount = useMemo(
    () =>
      (myTasks ?? []).filter((t) => checkOverdue(t.deadline, t.status)).length,
    [myTasks]
  )

  // Member-specific: hours the user personally clocked today (from their
  // own attendance, not the team-wide sum). Sessions without a signOut
  // use computeLiveHours so an active timer keeps ticking.
  const myHoursToday = useMemo(() => {
    return (myAttendance?.sessions ?? []).reduce(
      (s, se) =>
        s + (se.hours ?? computeLiveHours(se.signInAt, se.signOutAt)),
      0
    )
  }, [myAttendance])

  const myActiveCount = useMemo(
    () =>
      (myTasks ?? []).filter(
        (t) => t.status !== 'DONE' && !checkOverdue(t.deadline, t.status)
      ).length,
    [myTasks]
  )

  // Weekly aggregates for owner view
  const { thisWeek, lastWeek } = useMemo(() => {
    const now = new Date()
    const midpoint = new Date(now)
    midpoint.setDate(midpoint.getDate() - 7)

    let thisWeek = 0
    let lastWeek = 0
    for (const r of report ?? []) {
      const d = new Date(r.date)
      const hrs = r.sessions.reduce(
        (s, se) =>
          s + (se.hours ?? computeLiveHours(se.signInAt, se.signOutAt)),
        0
      )
      if (d >= midpoint) thisWeek += hrs
      else lastWeek += hrs
    }
    return { thisWeek, lastWeek }
  }, [report])

  const weekTrend = computeTrend(thisWeek, lastWeek)

  // Exclude OWNER — "team members" means people the org manages,
  // not the account holder themselves. Matches the count on /admin/users.
  const teamSize = (users ?? []).filter((u) => u.systemRole !== 'OWNER').length
  const projectCount = (projects ?? []).length

  const metrics: Metric[] =
    role === 'OWNER'
      ? [
          {
            key: 'team',
            label: 'Team members',
            value: teamSize,
            icon: Users,
            accent: 'text-indigo-600 bg-indigo-50',
          },
          {
            key: 'week-hours',
            label: 'Hours this week',
            value: formatHours(thisWeek),
            icon: Clock,
            accent: 'text-blue-600 bg-blue-50',
            trend: weekTrend,
            trendLabel: trendDelta(thisWeek, lastWeek, 'hrs'),
          },
          {
            key: 'projects',
            label: 'Active projects',
            value: projectCount,
            icon: CheckCircle2,
            accent: 'text-emerald-600 bg-emerald-50',
          },
          {
            key: 'overdue',
            label: 'Overdue',
            value: overdueCount,
            icon: AlertOctagon,
            accent:
              overdueCount > 0
                ? 'text-destructive bg-destructive/10'
                : 'text-muted-foreground bg-muted',
          },
        ]
      : role === 'MEMBER'
        ? [
            {
              // Member's own hours, not team sum — ties to useMyAttendance.
              key: 'my-hours-today',
              label: 'My hours today',
              value: formatHours(myHoursToday),
              icon: Clock,
              accent: 'text-blue-600 bg-blue-50',
              live: myAttendance?.status === 'SIGNED_IN',
            },
            {
              key: 'my-active',
              label: 'Active tasks',
              value: myActiveCount,
              icon: Users,
              accent: 'text-indigo-600 bg-indigo-50',
            },
            {
              key: 'my-completed',
              label: 'Completed today',
              value: completedToday,
              icon: CheckCircle2,
              accent: 'text-emerald-600 bg-emerald-50',
            },
            {
              key: 'my-overdue',
              label: 'Overdue',
              value: overdueCount,
              icon: AlertOctagon,
              accent:
                overdueCount > 0
                  ? 'text-destructive bg-destructive/10'
                  : 'text-muted-foreground bg-muted',
            },
          ]
        : [
            {
              key: 'working',
              label: 'Working now',
              value: workingNow,
              icon: Users,
              accent: 'text-emerald-600 bg-emerald-50',
              live: workingNow > 0,
            },
            {
              key: 'today-hours',
              label: 'Hours today',
              value: formatHours(hoursToday),
              icon: Clock,
              accent: 'text-blue-600 bg-blue-50',
            },
            {
              key: 'completed',
              label: 'Completed today',
              value: completedToday,
              icon: CheckCircle2,
              accent: 'text-indigo-600 bg-indigo-50',
            },
            {
              key: 'overdue',
              label: 'Overdue',
              value: overdueCount,
              icon: AlertOctagon,
              accent:
                overdueCount > 0
                  ? 'text-destructive bg-destructive/10'
                  : 'text-muted-foreground bg-muted',
            },
          ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-rise">
      {metrics.map((m) => {
        const Icon = m.icon
        return (
          <Card
            key={m.key}
            className="group flex items-center gap-3 p-4 transition-all hover:shadow-card-hover hover-lift-sm"
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform icon-pop',
                m.accent
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {typeof m.value === 'number' ? (
                    <AnimatedNumber value={m.value} />
                  ) : (
                    m.value
                  )}
                </p>
                {m.live && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                )}
                {m.trend && <TrendBadge trend={m.trend} label={m.trendLabel} />}
              </div>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function TrendBadge({ trend, label }: { trend: Trend; label?: string }) {
  const styles = {
    up: 'text-emerald-600',
    down: 'text-destructive',
    flat: 'text-muted-foreground',
  }[trend]
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold', styles)}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {label && <span>{label}</span>}
    </span>
  )
}

function computeTrend(current: number, previous: number): Trend {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return 'up'
  const pct = ((current - previous) / previous) * 100
  if (pct > 3) return 'up'
  if (pct < -3) return 'down'
  return 'flat'
}

function trendDelta(current: number, previous: number, unit: string): string {
  const diff = current - previous
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(0)} ${unit}`
}

function computeLiveHours(signInAt: string, signOutAt: string | null): number {
  if (signOutAt) return 0
  return Math.max(0, (Date.now() - new Date(signInAt).getTime()) / 3_600_000)
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h.toFixed(1)}h`
}
