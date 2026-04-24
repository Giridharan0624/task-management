'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  ListTodo,
  Palmtree,
  PauseCircle,
  RefreshCw,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useWeeklyRollup } from '@/lib/hooks/useTaskUpdates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

/** Returns the Monday of the week that contains `d` in local time. */
function mondayOf(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const dow = out.getDay() // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + diff)
  return out
}

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const fmt = (x: Date, opts: Intl.DateTimeFormatOptions) =>
    x.toLocaleDateString(undefined, opts)
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${fmt(s, { month: 'short', day: 'numeric' })} – ${fmt(e, { day: 'numeric', year: 'numeric' })}`
  }
  return `${fmt(s, { month: 'short', day: 'numeric' })} – ${fmt(e, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function WeeklyRollupPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const weekStartIso = iso(weekStart)
  const isOwnerOrAdmin =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  const { data, isLoading, isFetching, isError, error, refetch } =
    useWeeklyRollup(weekStartIso, isOwnerOrAdmin)

  const currentWeekStartIso = iso(mondayOf(new Date()))
  const isCurrentWeek = weekStartIso === currentWeekStartIso

  const shiftWeek = (days: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + days)
    setWeekStart(next)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['task-updates', 'weekly-rollup', weekStartIso],
    })
    refetch()
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Weekly rollups are available to owners and admins.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-16 animate-fade-in">
      <PageHeader
        title="Weekly rollup"
        description="AI-assisted digest of this week's task updates."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Reports
            </Link>
          </div>
        }
      />

      {/* Week selector row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => shiftWeek(-7)}
            className="h-8 w-8 p-0"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-[220px] items-center justify-center gap-2 px-3 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {data ? formatRange(data.weekStart, data.weekEnd) : formatRange(
              weekStartIso,
              iso(new Date(weekStart.getTime() + 6 * 86400000)),
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => shiftWeek(7)}
            className="h-8 w-8 p-0"
            disabled={isCurrentWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(mondayOf(new Date()))}
            >
              This week
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
            />
            Regenerate
          </Button>
        </div>
      </div>

      {isLoading && (
        <LoadingState />
      )}

      {isError && !isLoading && (
        <Card className="border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Could not generate the weekly rollup
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                className="mt-3"
              >
                Try again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {data && !isLoading && <RollupContent data={data} />}
    </div>
  )
}

function LoadingState() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        <p className="text-sm font-semibold text-foreground">
          Compiling the week — this usually takes 10–30 seconds.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 p-12">
        <Spinner size="md" />
        <p className="text-xs text-muted-foreground">
          Reading task updates, aggregating, and drafting the narrative…
        </p>
      </div>
    </Card>
  )
}

interface RollupData {
  weekStart: string
  weekEnd: string
  teamSize: number
  // The rollup endpoint can omit any of these sections — or individual
  // leaves inside them — when the week is sparse. Mark optional all the
  // way down so TS flags unsafe access; `RollupContent` deep-defaults
  // every leaf below.
  metrics?: {
    // Task-update slice
    totalUpdates?: number
    contributorCount?: number
    totalHours?: number
    missingDays?: string[]
    // Attendance slice (objective timer)
    attendanceTotalHours?: number
    attendanceContributorCount?: number
    attendanceSessionsCount?: number
    // Activity slice (desktop signals)
    activityAvgScore?: number
    activityTotalActiveMinutes?: number
    activityTotalIdleMinutes?: number
    activityContributorCount?: number
    // Day-off slice
    dayoffsApprovedCount?: number
    dayoffsDaysLost?: number
  }
  byContributor?: {
    name: string
    updates: number
    hours: number
    tasks: number
  }[]
  byTask?: {
    taskName: string
    hours: number
    contributors: number
    updates: number
  }[]
  byDay?: { date: string; updates: number; hours: number }[]
  // New per-dimension breakdowns
  attendanceByDay?: {
    date: string
    hours: number
    sessions: number
    signedInCount: number
  }[]
  attendanceByContributor?: {
    name: string
    hours: number
    sessions: number
  }[]
  activityTopApps?: { appName: string; minutes: number }[]
  dayoffsRequests?: {
    name: string
    startDate: string
    endDate: string
    daysInWindow: number
    reason: string
  }[]
  narrative?: {
    headline?: string
    summary?: string
    highlights?: string[]
    notablePatterns?: string[]
    concerns?: string[]
  }
  generatedAt?: string
}

function RollupContent({ data }: { data: RollupData }) {
  // Deep-default every leaf of the potentially-missing sections so the
  // render tree below can reference non-null values without `?? 0` /
  // `?? []` noise at every site. The rollup endpoint omits not just
  // whole sections but sometimes individual fields on sparse weeks.
  const byDay = data.byDay ?? []
  const byContributor = data.byContributor ?? []
  const byTask = data.byTask ?? []
  const attendanceByDay = data.attendanceByDay ?? []
  const attendanceByContributor = data.attendanceByContributor ?? []
  const activityTopApps = data.activityTopApps ?? []
  const dayoffRequests = data.dayoffsRequests ?? []
  const metrics = {
    totalUpdates: data.metrics?.totalUpdates ?? 0,
    contributorCount: data.metrics?.contributorCount ?? 0,
    totalHours: data.metrics?.totalHours ?? 0,
    missingDays: data.metrics?.missingDays ?? [],
    attendanceTotalHours: data.metrics?.attendanceTotalHours ?? 0,
    attendanceContributorCount:
      data.metrics?.attendanceContributorCount ?? 0,
    attendanceSessionsCount: data.metrics?.attendanceSessionsCount ?? 0,
    activityAvgScore: data.metrics?.activityAvgScore ?? 0,
    activityTotalActiveMinutes:
      data.metrics?.activityTotalActiveMinutes ?? 0,
    activityTotalIdleMinutes:
      data.metrics?.activityTotalIdleMinutes ?? 0,
    activityContributorCount: data.metrics?.activityContributorCount ?? 0,
    dayoffsApprovedCount: data.metrics?.dayoffsApprovedCount ?? 0,
    dayoffsDaysLost: data.metrics?.dayoffsDaysLost ?? 0,
  }
  const narrative = {
    headline: data.narrative?.headline ?? '',
    summary: data.narrative?.summary ?? '',
    highlights: data.narrative?.highlights ?? [],
    notablePatterns: data.narrative?.notablePatterns ?? [],
    concerns: data.narrative?.concerns ?? [],
  }

  const maxDayHours = useMemo(
    () => Math.max(1, ...byDay.map((d) => d.hours)),
    [byDay],
  )
  // `hasData` is true if ANY dimension has something to show — previously
  // the page collapsed to the empty-state whenever task updates were
  // missing, even if the team logged plenty of timer hours.
  const hasData =
    metrics.totalUpdates > 0 ||
    metrics.attendanceTotalHours > 0 ||
    metrics.activityTotalActiveMinutes > 0 ||
    metrics.dayoffsApprovedCount > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Narrative hero */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            AI summary
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {narrative.headline || 'Weekly digest'}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {narrative.summary}
          </p>

          {data.generatedAt && (
            <p className="mt-5 text-[11px] text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </Card>

      {/* Metric strip — row 1: self-reported (task updates) */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Task updates · self-reported
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            Icon={ListTodo}
            label="Updates"
            value={metrics.totalUpdates}
            tint="from-indigo-500/15 text-indigo-600 dark:text-indigo-300"
          />
          <MetricTile
            Icon={Users}
            label="Contributors"
            value={`${metrics.contributorCount}${
              data.teamSize > 0 ? ` / ${data.teamSize}` : ''
            }`}
            tint="from-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          />
          <MetricTile
            Icon={Clock}
            label="Hours reported"
            value={`${Math.round(metrics.totalHours * 10) / 10}h`}
            tint="from-amber-500/15 text-amber-600 dark:text-amber-300"
          />
          <MetricTile
            Icon={CalendarDays}
            label="Missing days"
            value={metrics.missingDays.length}
            tint="from-rose-500/15 text-rose-600 dark:text-rose-300"
          />
        </div>
      </div>

      {/* Metric strip — row 2: objective signals (attendance + activity) */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Objective signals · timer &amp; desktop activity
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            Icon={Timer}
            label="Timer hours"
            value={`${Math.round(metrics.attendanceTotalHours * 10) / 10}h`}
            tint="from-blue-500/15 text-blue-600 dark:text-blue-300"
          />
          <MetricTile
            Icon={Clock}
            label="Sessions"
            value={metrics.attendanceSessionsCount}
            tint="from-cyan-500/15 text-cyan-600 dark:text-cyan-300"
          />
          <MetricTile
            Icon={Gauge}
            label="Avg focus"
            value={`${metrics.activityAvgScore}%`}
            tint="from-violet-500/15 text-violet-600 dark:text-violet-300"
          />
          <MetricTile
            Icon={PauseCircle}
            label="Idle"
            value={`${Math.round(metrics.activityTotalIdleMinutes)}m`}
            tint="from-slate-500/15 text-slate-600 dark:text-slate-300"
          />
        </div>
      </div>

      {/* Metric strip — row 3: leave */}
      {metrics.dayoffsApprovedCount > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Leave this week
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile
              Icon={Palmtree}
              label="Approved leaves"
              value={metrics.dayoffsApprovedCount}
              tint="from-orange-500/15 text-orange-600 dark:text-orange-300"
            />
            <MetricTile
              Icon={CalendarDays}
              label="Person-days lost"
              value={metrics.dayoffsDaysLost}
              tint="from-pink-500/15 text-pink-600 dark:text-pink-300"
            />
          </div>
        </div>
      )}

      {hasData && (
        <>
          {/* Daily shape bar chart */}
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Hours by day
                </h3>
                <p className="text-xs text-muted-foreground">
                  Distribution of tracked time across the week.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Mon → Sun
              </span>
            </div>
            <div className="flex items-end gap-2 sm:gap-3">
              {byDay.map((d) => {
                const heightPct = (d.hours / maxDayHours) * 100
                const date = new Date(d.date + 'T00:00:00')
                const label = date
                  .toLocaleDateString(undefined, { weekday: 'short' })
                  .slice(0, 3)
                const empty = d.updates === 0
                return (
                  <div
                    key={d.date}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                  >
                    <div className="flex h-40 w-full items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-md transition-all',
                          empty
                            ? 'bg-muted'
                            : 'bg-gradient-to-t from-primary to-accent',
                        )}
                        style={{ height: `${Math.max(heightPct, 3)}%` }}
                        title={`${d.updates} update(s), ${d.hours}h`}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {label}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] tabular-nums',
                        empty ? 'text-muted-foreground/60' : 'text-foreground',
                      )}
                    >
                      {d.hours.toFixed(1)}h
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListCard
              title="Highlights"
              badge="AI"
              items={narrative.highlights}
              emptyHint="No standout highlights for this window."
              tone="primary"
            />
            <ListCard
              title="Notable patterns"
              items={narrative.notablePatterns}
              emptyHint="Nothing unusual about the week's shape."
              tone="muted"
            />
          </div>

          {narrative.concerns.length > 0 && (
            <Card className="border-amber-400/40 bg-amber-500/[0.04] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Things worth flagging
                </h3>
              </div>
              <ul className="space-y-2">
                {narrative.concerns.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground/90"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  Top contributors
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  by hours
                </span>
              </div>
              <ul className="divide-y divide-border">
                {byContributor.slice(0, 8).map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.updates} update{c.updates === 1 ? '' : 's'} ·{' '}
                        {c.tasks} task{c.tasks === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                      {c.hours.toFixed(1)}h
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  Top tasks
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  by hours
                </span>
              </div>
              <ul className="divide-y divide-border">
                {byTask.slice(0, 8).map((t) => (
                  <li
                    key={t.taskName}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {t.taskName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.contributors} contributor
                        {t.contributors === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                      {t.hours.toFixed(1)}h
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Attendance + Activity + Leave — only render the grid rows that
              actually have content so a team with no timer use doesn't get
              a wall of empty cards. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {attendanceByContributor.length > 0 && (
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    Timer hours by member
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    objective
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {attendanceByContributor.slice(0, 8).map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.sessions} session
                          {c.sessions === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                        {c.hours.toFixed(1)}h
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {activityTopApps.length > 0 && (
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">
                      Top apps
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    by minutes
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {activityTopApps.map((a) => (
                    <li
                      key={a.appName}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.appName}
                      </p>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                        {a.minutes}m
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {dayoffRequests.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Palmtree className="h-3.5 w-3.5 text-orange-500" />
                <h3 className="text-sm font-bold text-foreground">
                  Approved leave overlapping this week
                </h3>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {metrics.dayoffsDaysLost} person-day
                  {metrics.dayoffsDaysLost === 1 ? '' : 's'} in window
                </span>
              </div>
              <ul className="divide-y divide-border">
                {dayoffRequests.map((r) => (
                  <li
                    key={`${r.name}-${r.startDate}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {r.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {formatRange(r.startDate, r.endDate)}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                      {r.daysInWindow} day
                      {r.daysInWindow === 1 ? '' : 's'} in window
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {!hasData && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">
            No task updates submitted this week.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Members submit their daily update at the end of their session in the
            desktop application.
          </p>
        </Card>
      )}
    </div>
  )
}

interface MetricTileProps {
  Icon: typeof Clock
  label: string
  value: string | number
  tint: string
}

function MetricTile({ Icon, label, value, tint }: MetricTileProps) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80',
          tint.split(' ')[0],
        )}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ring-white/20',
            tint,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </div>
    </Card>
  )
}

interface ListCardProps {
  title: string
  badge?: string
  items: string[]
  emptyHint: string
  tone: 'primary' | 'muted'
}

function ListCard({ title, badge, items, emptyHint, tone }: ListCardProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            {badge}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-foreground/90"
            >
              <span
                className={cn(
                  'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                  tone === 'primary' ? 'bg-primary' : 'bg-muted-foreground/50',
                )}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
