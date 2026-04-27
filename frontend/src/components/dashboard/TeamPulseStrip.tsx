'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import {
  useTodayAttendance,
  useAttendanceReport,
  useMyAttendance,
} from '@/lib/hooks/useAttendance'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useProjects } from '@/lib/hooks/useProjects'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { cn } from '@/lib/utils'

type Trend = 'up' | 'down' | 'flat'

interface Metric {
  key: string
  label: string
  value: number | string
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
  const { current } = useTenant()

  // Calendar-week aligned window for "this week" / "last week" buckets.
  // Bucket boundaries follow the tenant's `weekStartDay` (0 = Sunday, 1 =
  // Monday, …) — a rolling 7-day window swept hours from the prior
  // calendar week into "this week" on Monday/Tuesday and confused owners
  // who expected Sun-Sat (or Mon-Sun) totals.
  const weekStartDay = current?.settings?.weekStartDay ?? 1
  const dates = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const offsetIntoWeek = (today.getDay() - weekStartDay + 7) % 7
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - offsetIntoWeek)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(thisWeekStart.getDate() - 7)
    return {
      start: ymd(lastWeekStart),
      end: ymd(today),
      thisWeekStart,
    }
  }, [weekStartDay])
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

  // Weekly aggregates for owner view — buckets days by their position
  // relative to `thisWeekStart` (calendar week aligned to tenant config).
  const { thisWeek, lastWeek } = useMemo(() => {
    const boundary = dates.thisWeekStart.getTime()
    let thisWeek = 0
    let lastWeek = 0
    for (const r of report ?? []) {
      // r.date is YYYY-MM-DD from the API; parse as a local-midnight date
      // so the comparison aligns with `thisWeekStart` (also local midnight).
      const [y, m, d] = r.date.split('-').map(Number)
      const day = new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
      const hrs = r.sessions.reduce(
        (s, se) =>
          s + (se.hours ?? computeLiveHours(se.signInAt, se.signOutAt)),
        0
      )
      if (day >= boundary) thisWeek += hrs
      else lastWeek += hrs
    }
    return { thisWeek, lastWeek }
  }, [report, dates.thisWeekStart])

  const weekTrend = computeTrend(thisWeek, lastWeek)

  // Exclude OWNER — "team members" means people the org manages,
  // not the account holder themselves. Matches the count on /admin/users.
  const teamSize = (users ?? []).filter((u) => u.systemRole !== 'OWNER').length
  const projectCount = (projects ?? []).length

  const metrics: Metric[] =
    role === 'OWNER'
      ? [
          { key: 'team', label: 'Team members', value: teamSize },
          {
            key: 'week-hours',
            label: 'Hours this week',
            value: formatHours(thisWeek),
            trend: weekTrend,
            trendLabel: trendDelta(thisWeek, lastWeek, 'hrs'),
          },
          { key: 'projects', label: 'Active projects', value: projectCount },
          { key: 'overdue', label: 'Overdue', value: overdueCount },
        ]
      : role === 'MEMBER'
        ? [
            {
              // Member's own hours, not team sum — ties to useMyAttendance.
              key: 'my-hours-today',
              label: 'My hours today',
              value: formatHours(myHoursToday),
              live: myAttendance?.status === 'SIGNED_IN',
            },
            { key: 'my-active', label: 'Active tasks', value: myActiveCount },
            { key: 'my-completed', label: 'Completed today', value: completedToday },
            { key: 'my-overdue', label: 'Overdue', value: overdueCount },
          ]
        : [
            {
              key: 'working',
              label: 'Working now',
              value: workingNow,
              live: workingNow > 0,
            },
            { key: 'today-hours', label: 'Hours today', value: formatHours(hoursToday) },
            { key: 'completed', label: 'Completed today', value: completedToday },
            { key: 'overdue', label: 'Overdue', value: overdueCount },
          ]

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card lg:grid-cols-4 lg:divide-y-0">
      {metrics.map((m) => (
        <div key={m.key} className="flex flex-col px-5 py-4">
          <div className="flex items-center gap-2">
            {m.live && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {m.label}
            </p>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="text-2xl font-medium leading-none tabular-nums text-foreground [font-feature-settings:'tnum','lnum']">
              {typeof m.value === 'number' ? (
                <AnimatedNumber value={m.value} />
              ) : (
                m.value
              )}
            </p>
            {m.trend && <TrendBadge trend={m.trend} label={m.trendLabel} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendBadge({ trend, label }: { trend: Trend; label?: string }) {
  const styles = {
    up: 'text-emerald-700',
    down: 'text-rose-700',
    flat: 'text-muted-foreground',
  }[trend]
  const Icon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 text-[10px] font-medium uppercase tracking-[0.12em]',
        styles,
      )}
    >
      <Icon
        className="h-3 w-3 translate-y-[1px] self-center"
        strokeWidth={1.8}
      />
      {label && <span className="tabular-nums">{label}</span>}
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

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h.toFixed(1)}h`
}
