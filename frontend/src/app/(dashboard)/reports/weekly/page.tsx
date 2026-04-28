'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CalendarOff,
  ChevronRight,
  Clock,
  Gauge,
  Info,
  ListTodo,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useRegenerateWeeklyRollup,
  useWeeklyRollup,
} from '@/lib/hooks/useTaskUpdates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useFeatureFlag } from '@/components/tenant/FeatureGate'
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

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const weekStartIso = iso(weekStart)
  const isOwnerOrAdmin =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  const { data, isLoading, isFetching, isError, error } = useWeeklyRollup(
    weekStartIso,
    isOwnerOrAdmin,
  )
  const regenerate = useRegenerateWeeklyRollup()

  const currentWeekStartIso = iso(mondayOf(new Date()))
  const isCurrentWeek = weekStartIso === currentWeekStartIso

  const shiftWeek = (days: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + days)
    setWeekStart(next)
  }

  // Force a fresh Groq run via the server. The mutation seeds React
  // Query's cache with the new payload on success so the page swaps
  // in the regenerated rollup without a second fetch.
  const handleRegenerate = () => {
    if (regenerate.isPending) return
    regenerate.mutate(weekStartIso)
  }
  const isBusy = isFetching || regenerate.isPending

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
        description="AI-assisted digest of this week's work."
        actions={
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Reports
          </Link>
        }
      />

      {/* Week navigator + actions — single row */}
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
            {data
              ? formatRange(data.weekStart, data.weekEnd)
              : formatRange(
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
            onClick={handleRegenerate}
            disabled={isBusy}
            className="gap-1.5"
            aria-label="Regenerate this week's AI rollup"
            title="Force a fresh AI generation. Otherwise the cached rollup is reused."
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isBusy && 'animate-spin')}
            />
            Regenerate
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card className="flex flex-col items-center gap-3 p-12">
          <Spinner size="md" />
          <p className="text-xs text-muted-foreground">
            Reading task updates, aggregating, and drafting the narrative…
          </p>
        </Card>
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
                onClick={handleRegenerate}
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

interface RollupData {
  weekStart: string
  weekEnd: string
  teamSize: number
  // Every leaf is optional — the rollup endpoint omits sections (or
  // individual fields) when the week is sparse. RollupContent
  // deep-defaults below so the render tree never reads `undefined`.
  metrics?: {
    totalUpdates?: number
    contributorCount?: number
    totalHours?: number
    missingDays?: string[]
    attendanceTotalHours?: number
    attendanceContributorCount?: number
    attendanceSessionsCount?: number
    activityAvgScore?: number
    activityTotalActiveMinutes?: number
    activityTotalIdleMinutes?: number
    activityContributorCount?: number
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
  anomalies?: {
    kind: string
    severity: 'info' | 'warn' | 'alert'
    title: string
    detail: string
    subject?: string
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
  const byDay = data.byDay ?? []
  const attendanceByDay = data.attendanceByDay ?? []
  const byTask = data.byTask ?? []
  const dayoffRequests = data.dayoffsRequests ?? []
  const anomalies = data.anomalies ?? []
  // When the tenant has `ai_summaries` off, hide the LLM-generated
  // narrative pieces (eyebrow label, AI headline, summary paragraph,
  // highlights/concerns/patterns lists) but keep the factual metric
  // strips and tables visible — those are non-AI aggregations.
  const aiSummariesEnabled = useFeatureFlag('ai_summaries')

  // Members table merges the task-update slice (updates / tasks per
  // person) with the timer slice (objective hours per person). One
  // row per person; tracked hours win when both are present so the
  // most truthful number leads the read.
  const members = useMemo(() => {
    const map = new Map<
      string,
      { name: string; hours: number; updates: number; tasks: number }
    >()
    for (const c of data.byContributor ?? []) {
      map.set(c.name, {
        name: c.name,
        hours: c.hours,
        updates: c.updates,
        tasks: c.tasks,
      })
    }
    for (const a of data.attendanceByContributor ?? []) {
      const existing = map.get(a.name)
      // Tracked timer hours overwrite the self-reported number — they
      // are objective. Self-reported updates/tasks stay as-is.
      map.set(a.name, {
        name: a.name,
        hours: a.hours,
        updates: existing?.updates ?? 0,
        tasks: existing?.tasks ?? 0,
      })
    }
    return [...map.values()].sort((x, y) => y.hours - x.hours)
  }, [data.byContributor, data.attendanceByContributor])

  const metrics = {
    totalUpdates: data.metrics?.totalUpdates ?? 0,
    contributorCount: data.metrics?.contributorCount ?? 0,
    attendanceTotalHours: data.metrics?.attendanceTotalHours ?? 0,
    attendanceContributorCount: data.metrics?.attendanceContributorCount ?? 0,
    activityAvgScore: data.metrics?.activityAvgScore ?? 0,
    activityTotalActiveMinutes: data.metrics?.activityTotalActiveMinutes ?? 0,
    missingDays: data.metrics?.missingDays ?? [],
    dayoffsDaysLost: data.metrics?.dayoffsDaysLost ?? 0,
  }
  const narrative = {
    headline: data.narrative?.headline ?? '',
    summary: data.narrative?.summary ?? '',
    highlights: data.narrative?.highlights ?? [],
    notablePatterns: data.narrative?.notablePatterns ?? [],
    concerns: data.narrative?.concerns ?? [],
  }

  // Use timer hours per day when available; fall back to the
  // self-reported per-day series. Either way the chart shows ONE
  // dimension instead of competing with itself.
  const dailySeries = useMemo(() => {
    if (attendanceByDay.length > 0) {
      return attendanceByDay.map((d) => ({ date: d.date, hours: d.hours }))
    }
    return byDay.map((d) => ({ date: d.date, hours: d.hours }))
  }, [attendanceByDay, byDay])

  const maxDayHours = useMemo(
    () => Math.max(1, ...dailySeries.map((d) => d.hours)),
    [dailySeries],
  )

  // Concerns expand with system-detected concerns: if members did not
  // submit on every day, surface that here rather than spending a tile
  // on it. Keeps the rollup focused on what's actionable.
  const concerns = useMemo(() => {
    const list = [...narrative.concerns]
    if (metrics.missingDays.length > 0) {
      list.push(
        `${metrics.missingDays.length} day${
          metrics.missingDays.length === 1 ? '' : 's'
        } with zero submitted updates.`,
      )
    }
    return list
  }, [narrative.concerns, metrics.missingDays])

  // Headline metrics — the four numbers that belong inside the hero.
  // Anything more fragments the read; anything fewer feels skinny.
  const activeMembers =
    metrics.attendanceContributorCount || metrics.contributorCount
  const trackedHours =
    metrics.attendanceTotalHours > 0
      ? Math.round(metrics.attendanceTotalHours * 10) / 10
      : 0

  const hasData =
    metrics.totalUpdates > 0 ||
    metrics.attendanceTotalHours > 0 ||
    metrics.activityTotalActiveMinutes > 0 ||
    metrics.dayoffsDaysLost > 0

  if (!hasData) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">
          Nothing to summarize for this week.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          No timer hours, task updates, or leave records fell inside the
          window.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. AI summary hero with inline metrics ── */}
      <Card className="relative overflow-hidden p-6 shadow-none sm:p-8">
        {/* Single-color top hairline replaces the blurred halo + gradient
            fade — analyst-page chrome rather than marketing surface. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary"
        />
        <div className="relative">
          {aiSummariesEnabled && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" strokeWidth={1.8} />
              AI summary
            </span>
          )}
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {aiSummariesEnabled
              ? narrative.headline || 'Weekly digest'
              : 'Weekly digest'}
          </h2>
          {aiSummariesEnabled && narrative.summary && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {narrative.summary}
            </p>
          )}

          {/* Inline metric strip — replaces the three previous strips. */}
          <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card sm:grid-cols-4 sm:divide-y-0">
            <HeroMetric
              Icon={Clock}
              label="Tracked hours"
              value={`${trackedHours}h`}
              tint="text-sky-700"
            />
            <HeroMetric
              Icon={Users}
              label="Active members"
              value={`${activeMembers}${
                data.teamSize > 0 ? ` / ${data.teamSize}` : ''
              }`}
              tint="text-emerald-700"
            />
            <HeroMetric
              Icon={ListTodo}
              label="Updates"
              value={metrics.totalUpdates}
              tint="text-indigo-700"
            />
            <HeroMetric
              Icon={Gauge}
              label="Avg focus"
              value={`${metrics.activityAvgScore}%`}
              tint="text-violet-700"
            />
          </div>

          {data.generatedAt && (
            <p className="mt-5 text-[11px] text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </Card>

      {/* ── 2. Daily shape — single bar series ── */}
      {dailySeries.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h3 className="text-sm font-bold text-foreground">Hours by day</h3>
          <div className="mt-4 flex items-end gap-2 sm:gap-3">
            {dailySeries.map((d) => {
              const heightPct = (d.hours / maxDayHours) * 100
              const date = new Date(d.date + 'T00:00:00')
              const label = date
                .toLocaleDateString(undefined, { weekday: 'short' })
                .slice(0, 3)
              const empty = d.hours === 0
              return (
                <div
                  key={d.date}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-32 w-full items-end">
                    <div
                      className={cn(
                        'w-full rounded-sm transition-all',
                        empty ? 'bg-muted' : 'bg-foreground/85',
                      )}
                      style={{ height: `${Math.max(heightPct, 3)}%` }}
                      title={`${d.hours.toFixed(1)}h`}
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
      )}

      {/* ── 3. Insights — Highlights / Patterns / Concerns in one card.
              Hidden entirely when ai_summaries is off; the lists are
              LLM output not raw aggregations. ── */}
      {aiSummariesEnabled &&
        (narrative.highlights.length > 0 ||
          narrative.notablePatterns.length > 0 ||
          concerns.length > 0) && (
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Insights</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <InsightSection
              label="Highlights"
              items={narrative.highlights}
              dotClass="bg-primary"
            />
            <InsightSection
              label="Patterns"
              items={narrative.notablePatterns}
              dotClass="bg-muted-foreground/60"
            />
            <InsightSection
              label="Concerns"
              items={concerns}
              dotClass="bg-amber-500"
              accent={concerns.length > 0}
            />
          </div>
        </Card>
      )}

      {/* ── 3b. Anomalies — only render when the detector found anything ── */}
      {anomalies.length > 0 && <AnomaliesCard anomalies={anomalies} />}

      {/* ── 4. Members + Tasks ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {members.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-bold text-foreground">
              Members this week
            </h3>
            <ul className="divide-y divide-border">
              {members.slice(0, 6).map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.updates} update{m.updates === 1 ? '' : 's'}
                      {m.tasks > 0
                        ? ` · ${m.tasks} task${m.tasks === 1 ? '' : 's'}`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                    {m.hours.toFixed(1)}h
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {byTask.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-bold text-foreground">
              Top tasks
            </h3>
            <ul className="divide-y divide-border">
              {byTask.slice(0, 6).map((t) => (
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
        )}
      </div>

      {/* ── 5. Leave (only when present) ── */}
      {dayoffRequests.length > 0 && (
        <Card className="p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <CalendarOff className="h-3.5 w-3.5 text-orange-500" />
            <h3 className="text-sm font-bold text-foreground">
              Approved leave this week
            </h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {metrics.dayoffsDaysLost} person-day
              {metrics.dayoffsDaysLost === 1 ? '' : 's'}
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
                  {r.daysInWindow} day{r.daysInWindow === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

interface HeroMetricProps {
  Icon: typeof Clock
  label: string
  value: string | number
  tint: string
}

function HeroMetric({ Icon, label, value, tint }: HeroMetricProps) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon
          className={cn('h-3 w-3', tint)}
          strokeWidth={1.8}
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
          {label}
        </p>
      </div>
      <div className="min-w-0">
        <p className={cn('text-2xl font-medium tabular-nums leading-none', tint)}>
          {value}
        </p>
      </div>
    </div>
  )
}

interface AnomaliesCardProps {
  anomalies: NonNullable<RollupData['anomalies']>
}

// Visual treatment per severity. Severity ordering matters — the
// detector emits them in detection order, but we want alerts at the
// top so the most urgent items lead the read.
const SEVERITY_RANK: Record<'alert' | 'warn' | 'info', number> = {
  alert: 0,
  warn: 1,
  info: 2,
}

const SEVERITY_TONE: Record<
  'alert' | 'warn' | 'info',
  { ring: string; iconClass: string; chipClass: string; Icon: typeof Info }
> = {
  alert: {
    ring: 'ring-rose-400/40',
    iconClass: 'text-rose-600 dark:text-rose-400',
    chipClass:
      'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    Icon: AlertOctagon,
  },
  warn: {
    ring: 'ring-amber-400/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    chipClass:
      'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  info: {
    ring: 'ring-sky-400/40',
    iconClass: 'text-sky-600 dark:text-sky-300',
    chipClass:
      'border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    Icon: Info,
  },
}

function AnomaliesCard({ anomalies }: AnomaliesCardProps) {
  const sorted = [...anomalies].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  )

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-foreground">
          Anomalies this week
        </h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {anomalies.length} detected
        </span>
      </div>
      <ul className="divide-y divide-border">
        {sorted.map((a, i) => {
          const tone = SEVERITY_TONE[a.severity] ?? SEVERITY_TONE.info
          const Icon = tone.Icon
          return (
            <li key={`${a.kind}-${i}`} className="flex items-start gap-3 py-3">
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                  tone.ring,
                  tone.iconClass,
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    {a.title}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                      tone.chipClass,
                    )}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {a.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

interface InsightSectionProps {
  label: string
  items: string[]
  dotClass: string
  /** When true, render the section with a soft amber tint —
   *  reserved for "Concerns" when the list is non-empty. */
  accent?: boolean
}

function InsightSection({
  label,
  items,
  dotClass,
  accent,
}: InsightSectionProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-3 transition-colors',
        accent && 'bg-amber-500/[0.06] ring-1 ring-inset ring-amber-400/30',
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {accent && (
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        )}
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] leading-snug text-foreground/90"
            >
              <span
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  dotClass,
                )}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
