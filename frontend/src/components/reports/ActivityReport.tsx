'use client'

import { useState, useMemo } from 'react'
import {
  useActivityReport,
  useSummary,
  useGenerateSummary,
} from '@/lib/hooks/useActivity'
import { useUsers } from '@/lib/hooks/useUsers'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Clock,
  PauseCircle,
  Gauge,
  Keyboard,
  Mouse,
  Layers,
  AlertTriangle,
  Search,
  X,
  FileDown,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Input } from '@/components/ui/Input'
import { formatDuration } from '@/lib/utils/formatDuration'
import { buildCsvName } from '@/lib/utils/csvFilename'
import { cn } from '@/lib/utils'
import { ScreenshotGallery } from './ScreenshotGallery'
import { useFeatureFlag } from '@/components/tenant/FeatureGate'
import type { UserActivity, DailySummary } from '@/lib/api/activityApi'
import type { User } from '@/types/user'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// Theme-driven chart palette. The 8 colors are read from CSS
// variables (`--chart-1` … `--chart-8`) which `applyThemePreset`
// rewrites on every theme change, so a Velour workspace renders
// burgundy/rose bars and a Cypress workspace renders forest/bronze
// — without this file knowing anything about the theme catalog.
const APP_BAR_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

// Active vs Idle: theme-driven so the donut tracks the workspace
// palette. Index 0 = the theme's primary chart slot (the most
// "alive" color); index 4 = the secondary/warning slot (amber-ish
// for most themes, ochre/champagne for Atelier/Meridian).
const ACTIVE_INK = 'var(--chart-1)'
const IDLE_INK = 'var(--chart-5)'

// Semantic status palette — vivid Tailwind 600s so the dots + value
// numerals carry visual weight against the white card surface.
const STATUS_INK: Record<'good' | 'mid' | 'low' | 'neutral', string> = {
  good: '#059669',     // emerald-600
  mid: '#d97706',      // amber-600
  low: '#e11d48',      // rose-600
  neutral: '#475569',  // slate-600
}
const STATUS_TINT: Record<'good' | 'mid' | 'low' | 'neutral', string> = {
  good: 'rgba(5,150,105,0.08)',
  mid: 'rgba(217,119,6,0.08)',
  low: 'rgba(225,29,72,0.08)',
  neutral: 'rgba(71,85,105,0.08)',
}

const ALL_USERS = 'ALL'

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pick the app the user spent the most seconds on. Returns null if empty. */
function topAppFor(activity: UserActivity): { name: string; seconds: number } | null {
  const entries = Object.entries(activity.appUsage)
  if (entries.length === 0) return null
  return entries.reduce(
    (best, [name, seconds]) => (seconds > best.seconds ? { name, seconds } : best),
    { name: entries[0][0], seconds: entries[0][1] },
  )
}

function generateActivityCSV(
  activities: UserActivity[],
  users: { userId: string; employeeId?: string }[],
): string {
  const rows: string[][] = [
    [
      'Name',
      'Email',
      'Employee ID',
      'Active (minutes)',
      'Idle (minutes)',
      'Activity score (%)',
      'Keystrokes',
      'Mouse events',
      'Buckets',
      'Top app',
      'Top app (minutes)',
    ],
  ]
  for (const a of activities) {
    const userInfo = users.find((u) => u.userId === a.userId)
    const kb = a.buckets.reduce((s, b) => s + (b.keyboardCount || 0), 0)
    const ms = a.buckets.reduce((s, b) => s + (b.mouseCount || 0), 0)
    const top = topAppFor(a)
    rows.push([
      a.userName || '',
      a.userEmail || '',
      userInfo?.employeeId || '',
      String(Math.round(a.totalActiveMinutes)),
      String(Math.round(a.totalIdleMinutes)),
      String(Math.round(a.activityScore * 100)),
      String(kb),
      String(ms),
      String(a.bucketCount),
      top?.name || '',
      top ? String(Math.round(top.seconds / 60)) : '',
    ])
  }
  return rows
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function ActivityReport() {
  const [date, setDate] = useState(() => toLocalDateStr(new Date()))
  const [selectedUser, setSelectedUser] = useState<string>(ALL_USERS)
  const [search, setSearch] = useState('')

  const { data: activities, isLoading } = useActivityReport(date, date)
  const { data: users } = useUsers()

  const filteredActivities = useMemo(() => {
    if (!activities) return []
    const q = search.trim().toLowerCase()
    return activities.filter((a) => {
      if (selectedUser !== ALL_USERS && a.userId !== selectedUser) return false
      if (q) {
        const userInfo = (users ?? []).find((u) => u.userId === a.userId)
        const hay =
          `${a.userName ?? ''} ${a.userEmail ?? ''} ${userInfo?.employeeId ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [activities, selectedUser, search, users])

  const userOptions = useMemo(
    () => (users ?? []).map((u) => ({ value: u.userId, label: u.name })),
    [users],
  )

  /**
   * Day-level summary — computed from ALL activities for the date, not
   * the currently-filtered list. The strip is a page header, so the
   * numbers should stay stable as the user narrows the card list below.
   */
  const daySummary = useMemo(() => {
    const all = activities ?? []
    const activeCount = all.filter(
      (a) => a.totalActiveMinutes > 0 || a.bucketCount > 0,
    ).length
    const totalActiveHours = all.reduce(
      (s, a) => s + a.totalActiveMinutes / 60,
      0,
    )
    const avgScore =
      all.length > 0
        ? Math.round(
            (all.reduce((s, a) => s + a.activityScore, 0) / all.length) * 100,
          )
        : 0
    return { activeCount, totalActiveHours, avgScore }
  }, [activities])

  const handleExport = () => {
    const rows = activities ?? []
    if (rows.length === 0) return
    const csv = generateActivityCSV(rows, users ?? [])
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName('activity', date, date)
    a.click()
  }

  const today = toLocalDateStr(new Date())
  const shiftDate = (by: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + by)
    setDate(toLocalDateStr(d))
  }
  const canGoNext = date < today
  const isToday = date === today

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="space-y-5">
      {/* Toolbar — date pill + member filter + jump-to-today */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftDate(-1)}
              className="h-7 w-7"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[180px] px-2 text-center text-sm font-semibold tabular-nums text-foreground">
              {dateLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftDate(1)}
              disabled={!canGoNext}
              className="h-7 w-7"
              aria-label="Next day"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!isToday && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setDate(today)}
              className="h-auto"
            >
              Jump to today
            </Button>
          )}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="min-w-[200px] max-w-[280px] flex-1">
            <Input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search />}
              rightIcon={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="pointer-events-auto rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : undefined
              }
              className="h-9"
            />
          </div>
          <FilterSelect
            value={selectedUser}
            onChange={setSelectedUser}
            options={[
              { value: ALL_USERS, label: 'All Members' },
              ...userOptions,
            ]}
            placeholder="Filter by member"
            className="w-48"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={!(activities && activities.length > 0)}
            className="h-9 gap-1.5"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && filteredActivities.length === 0 && (
        (activities?.length ?? 0) > 0 ? (
          <EmptyState
            icon={<Search className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />}
            title="No matches"
            description="Try clearing your search or filter to see more members."
            action={
              (search || selectedUser !== ALL_USERS) ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setSelectedUser(ALL_USERS)
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={<Clock className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />}
            title="No activity data"
            description={`Nothing was recorded on ${dateLabel}. The desktop app records activity while a timer is running.`}
          />
        )
      )}

      {(activities?.length ?? 0) > 0 && (
        <DaySummary
          activeCount={daySummary.activeCount}
          totalActiveHours={daySummary.totalActiveHours}
          avgScore={daySummary.avgScore}
        />
      )}

      {filteredActivities.length > 0 && (
        <div className="space-y-4 stagger-up">
          {filteredActivities.map((activity) => {
            const userInfo = (users ?? []).find((u) => u.userId === activity.userId)
            return (
              <ActivityCard
                key={activity.userId}
                activity={activity}
                date={date}
                userInfo={userInfo}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══ Per-user activity card ═══ */

function ActivityCard({
  activity,
  date,
  userInfo,
}: {
  activity: UserActivity
  date: string
  userInfo?: User
}) {
  const { data: summary } = useSummary(activity.userId, date)
  const generateMutation = useGenerateSummary()
  const [expanded, setExpanded] = useState(false)
  // Tenant-level feature toggle. When ai_summaries is off, hide both
  // the existing-summary block and the Generate button — backend
  // already rejects the call, but suppressing the UI avoids the
  // "click → 403 toast" UX. Existing rendered summaries (data already
  // returned by useSummary before the toggle flipped) also vanish.
  const aiSummariesEnabled = useFeatureFlag('ai_summaries')

  const scorePercent = Math.round(activity.activityScore * 100)
  const scoreTone: 'good' | 'mid' | 'low' =
    scorePercent >= 70 ? 'good' : scorePercent >= 40 ? 'mid' : 'low'

  const totalKeyboard = useMemo(
    () => activity.buckets.reduce((s, b) => s + (b.keyboardCount || 0), 0),
    [activity.buckets],
  )
  const totalMouse = useMemo(
    () => activity.buckets.reduce((s, b) => s + (b.mouseCount || 0), 0),
    [activity.buckets],
  )

  const appData = useMemo(() => {
    return Object.entries(activity.appUsage)
      .map(([name, seconds]) => ({ name, hours: Math.round(seconds / 36) / 100 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
  }, [activity.appUsage])

  const handleGenerate = () => {
    generateMutation.mutate({ userId: activity.userId, date })
  }

  return (
    <Card className="overflow-hidden border border-border/70 bg-card p-0 shadow-none">
      {/* Header — click anywhere to expand. Identity on the left, key
          stats on the right. Secondary stats (KB/Mouse/Intervals) move
          into the expanded body so the header doesn't overflow. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-3 px-6 py-5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:bg-muted/20',
          expanded && 'border-b border-border/60',
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-200',
              !expanded && '-rotate-90',
            )}
            strokeWidth={1.8}
          />
          <Avatar
            url={userInfo?.avatarUrl}
            name={activity.userName || activity.userEmail}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
              {activity.userName || 'User'}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {userInfo?.employeeId && (
                <>
                  <span className="font-medium tabular-nums text-foreground/70">
                    {userInfo.employeeId}
                  </span>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                </>
              )}
              {activity.userEmail}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center divide-x divide-border/60">
          <div className="px-5 first:pl-0 last:pr-0">
            <HeaderStat
              label="Active"
              value={formatDuration(activity.totalActiveMinutes / 60)}
              tone="good"
            />
          </div>
          <div className="px-5">
            <HeaderStat
              label="Idle"
              value={formatDuration(activity.totalIdleMinutes / 60)}
              tone="mid"
            />
          </div>
          <div className="px-5 last:pr-0">
            <HeaderStat
              label="Score"
              value={`${scorePercent}%`}
              tone={scoreTone}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="animate-fade-in">
          {/* Secondary stats row — tinted icon badges per metric so the
              row reads as distinct tiles, not a uniform strip. */}
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 bg-card">
            <SecondaryStat
              icon={Keyboard}
              label="Keystrokes"
              value={totalKeyboard.toLocaleString()}
              accent="var(--chart-1)"
            />
            <SecondaryStat
              icon={Mouse}
              label="Mouse events"
              value={totalMouse.toLocaleString()}
              accent="var(--chart-6)"
            />
            <SecondaryStat
              icon={Layers}
              label="Intervals"
              value={String(activity.bucketCount)}
              accent="var(--chart-3)"
            />
          </div>

          {/* Charts — wrapped in a light surface so the two panes read as
              a matched pair rather than floating on the muted background. */}
          {appData.length > 0 && (
            <div className="grid grid-cols-1 gap-px border-b border-border/60 bg-border/60 md:grid-cols-2">
              {/* App usage */}
              <div className="flex flex-col gap-4 bg-card p-6 sm:p-8">
                <ChartHeader label="App usage" suffix="hours" />
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, appData.length * 30)}
                >
                  <BarChart
                    data={appData}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 2, bottom: 0 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid
                      stroke="rgba(15,23,42,0.06)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fontSize: 10,
                        fill: '#94a3b8',
                        fontWeight: 500,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{
                        fontSize: 11,
                        fill: '#475569',
                        fontWeight: 500,
                      }}
                      width={120}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid rgba(15,23,42,0.12)',
                        boxShadow: 'none',
                        padding: '6px 10px',
                      }}
                      formatter={(v) => `${v}h`}
                    />
                    <Bar
                      dataKey="hours"
                      radius={[0, 1, 1, 0]}
                      barSize={10}
                      animationDuration={500}
                    >
                      {appData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={APP_BAR_PALETTE[i % APP_BAR_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Active vs Idle — thin ring + serif numeral hero */}
              <div className="flex flex-col gap-4 bg-card p-6 sm:p-8">
                <ChartHeader label="Active vs Idle" suffix="minutes" />
                <div className="relative mx-auto w-full max-w-[240px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Active',
                            value: Math.round(activity.totalActiveMinutes),
                          },
                          {
                            name: 'Idle',
                            value: Math.round(activity.totalIdleMinutes),
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={78}
                        outerRadius={92}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="transparent"
                        animationDuration={500}
                      >
                        <Cell fill={ACTIVE_INK} />
                        <Cell fill={IDLE_INK} />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 4,
                          border: '1px solid rgba(15,23,42,0.12)',
                          boxShadow: 'none',
                          padding: '6px 10px',
                        }}
                        formatter={(v) => `${v}m`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central ratio label — serif numeral, refined %  */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p
                      className="text-4xl font-normal leading-none tabular-nums [font-feature-settings:'tnum','lnum']"
                      style={{ color: ACTIVE_INK }}
                    >
                      {Math.round(
                        (activity.totalActiveMinutes /
                          Math.max(
                            1,
                            activity.totalActiveMinutes +
                              activity.totalIdleMinutes,
                          )) *
                          100,
                      )}
                      <span className="ml-0.5 align-super text-base font-light text-muted-foreground">
                        %
                      </span>
                    </p>
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      active
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-center gap-8 text-[11px]">
                  <span className="flex items-baseline gap-2">
                    <span
                      className="h-2 w-2 self-center rounded-sm"
                      style={{ backgroundColor: ACTIVE_INK }}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Active
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {Math.round(activity.totalActiveMinutes)}m
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span
                      className="h-2 w-2 self-center rounded-sm"
                      style={{ backgroundColor: IDLE_INK }}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Idle
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {Math.round(activity.totalIdleMinutes)}m
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Screenshots timeline */}
          {activity.screenshots && activity.screenshots.length > 0 && (
            <ScreenshotGallery screenshots={activity.screenshots} />
          )}

          {/* AI Summary — soft indigo wash + accented top hairline so
              the section reads as the app's primary "AI" surface,
              tying into the brand's indigo accent. Hidden entirely
              when the tenant has the `ai_summaries` feature off. */}
          {aiSummariesEnabled && (
          <div
            className="relative space-y-5 bg-primary/[0.04] p-6 sm:p-8"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary"
            />
            <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-baseline gap-2 text-foreground">
                <Sparkles
                  className="h-3 w-3 translate-y-px text-primary"
                  strokeWidth={1.8}
                />
                <p className="text-sm font-medium tracking-tight">
                  AI work summary
                </p>
              </div>
              {/* Promoted from a typographic ghost label to a real
                  button — the action is significant (kicks off a Groq
                  call), so it should look clickable. Sparkle icon
                  marks it as the AI affordance. */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generateMutation.isPending
                  ? 'Generating…'
                  : summary
                    ? 'Regenerate'
                    : 'Generate summary'}
              </Button>
            </div>

            {summary ? (
              <SummaryDisplay summary={summary} />
            ) : (
              <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                {generateMutation.isPending
                  ? 'Analysing activity data — headline, themes, and concerns usually take 10–30 seconds.'
                  : 'Generate an analyst narrative of this work session — apps used, focus patterns, and concerns surfaced from the raw activity stream.'}
              </p>
            )}

            {generateMutation.error && (
              <p
                className="flex items-center gap-1.5 text-[11px]"
                style={{ color: STATUS_INK.low }}
              >
                <AlertTriangle className="h-3 w-3" strokeWidth={1.6} />
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : 'Failed to generate summary'}
              </p>
            )}
          </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ═══ Header stat — label-over-value, status dot, hairline divider ═══ */

function HeaderStat({
  label,
  value,
  tone = 'neutral',
}: {
  // `icon` retained in the call sites for source compatibility but no
  // longer rendered — the editorial layout uses a status dot + label
  // instead, dropping the tinted icon chip that read as gamified.
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  tone?: 'good' | 'mid' | 'low' | 'neutral'
}) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: STATUS_INK[tone] }}
        />
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className="mt-0.5 text-lg font-medium tabular-nums [font-feature-settings:'tnum','lnum']"
        style={{ color: STATUS_INK[tone] }}
      >
        {value}
      </p>
    </div>
  )
}

function ChartHeader({
  label,
  suffix,
}: {
  label: string
  suffix?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-3">
      <p className="text-sm font-medium tracking-tight text-foreground">
        {label}
      </p>
      {suffix && (
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          {suffix}
        </span>
      )}
    </div>
  )
}

function SecondaryStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex flex-col gap-2 px-6 py-5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-3 w-3"
          strokeWidth={1.8}
          style={{ color: accent }}
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className="text-3xl font-normal tabular-nums [font-feature-settings:'tnum','lnum']"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  )
}

/* ═══ Day summary strip — team-wide totals for the selected date ═══ */

function DaySummary({
  activeCount,
  totalActiveHours,
  avgScore,
}: {
  activeCount: number
  totalActiveHours: number
  avgScore: number
}) {
  const scoreDot =
    avgScore >= 70 ? 'good' : avgScore >= 40 ? 'mid' : 'low'

  return (
    <Card className="grid grid-cols-3 divide-x divide-border/60 overflow-hidden p-0">
      <SummaryCell
        label="Members active"
        value={String(activeCount)}
      />
      <SummaryCell
        label="Total active"
        value={formatDuration(totalActiveHours)}
      />
      <SummaryCell
        label="Avg score"
        value={`${avgScore}%`}
        dot={scoreDot}
      />
    </Card>
  )
}

function SummaryCell({
  label,
  value,
  dot,
}: {
  label: string
  value: string
  dot?: 'good' | 'mid' | 'low' | 'neutral'
}) {
  return (
    <div className="flex flex-col gap-1.5 px-6 py-5">
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: STATUS_INK[dot] }}
          />
        )}
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className="text-2xl font-normal tabular-nums [font-feature-settings:'tnum','lnum']"
        style={dot ? { color: STATUS_INK[dot] } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

/* ═══ AI Summary display ═══ */

function SummaryDisplay({ summary }: { summary: DailySummary }) {
  const pct = Math.max(0, Math.min(100, summary.productivityScore * 10))
  const prodTone: 'good' | 'mid' | 'low' =
    summary.productivityScore >= 7
      ? 'good'
      : summary.productivityScore >= 4
        ? 'mid'
        : 'low'
  const prodInk = STATUS_INK[prodTone]

  return (
    <div className="space-y-6">
      {/* Narrative — drop-cap paragraph treatment lets it read as
          editorial copy, not a notification body. */}
      <p className="text-[14px] leading-[1.7] text-foreground/90">
        {summary.summary}
      </p>

      {summary.keyActivities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Themes
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-foreground">
            {summary.keyActivities.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    backgroundColor:
                      APP_BAR_PALETTE[i % APP_BAR_PALETTE.length],
                  }}
                />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.concerns.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Concerns
          </p>
          <ul className="space-y-1 text-[13px] text-foreground/80">
            {summary.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-[3px] h-3 w-3 shrink-0"
                  strokeWidth={1.6}
                  style={{ color: STATUS_INK.mid }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Productivity
          </span>
          <div className="h-[3px] w-40 overflow-hidden bg-border/60">
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${pct}%`, backgroundColor: prodInk }}
            />
          </div>
          <span
            className="text-base tabular-nums"
            style={{ color: prodInk }}
          >
            {summary.productivityScore}
            <span className="text-xs text-muted-foreground"> / 10</span>
          </span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Generated{' '}
          {new Date(summary.generatedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
