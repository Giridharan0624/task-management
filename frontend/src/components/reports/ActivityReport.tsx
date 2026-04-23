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
} from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Progress } from '@/components/ui/Progress'
import { formatDuration } from '@/lib/utils/formatDuration'
import { cn } from '@/lib/utils'
import { ScreenshotGallery } from './ScreenshotGallery'
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

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#34d399', '#2dd4bf', '#38bdf8', '#f97316',
  '#f472b6', '#fb7185', '#facc15', '#818cf8',
]

const ALL_USERS = 'ALL'

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ActivityReport() {
  const [date, setDate] = useState(() => toLocalDateStr(new Date()))
  const [selectedUser, setSelectedUser] = useState<string>(ALL_USERS)

  const { data: activities, isLoading } = useActivityReport(date, date)
  const { data: users } = useUsers()

  const filteredActivities = useMemo(() => {
    if (!activities) return []
    if (selectedUser !== ALL_USERS)
      return activities.filter((a) => a.userId === selectedUser)
    return activities
  }, [activities, selectedUser])

  const userOptions = useMemo(
    () => (users ?? []).map((u) => ({ value: u.userId, label: u.name })),
    [users],
  )

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

        <FilterSelect
          value={selectedUser}
          onChange={setSelectedUser}
          options={[{ value: ALL_USERS, label: 'All Members' }, ...userOptions]}
          placeholder="Filter by member"
          className="w-48"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && filteredActivities.length === 0 && (
        <EmptyState
          icon={<Clock className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />}
          title="No activity data"
          description={`Nothing was recorded on ${dateLabel}. The desktop app records activity while a timer is running.`}
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
    <Card className="overflow-hidden p-0 hover-lift-sm">
      {/* Header — click anywhere to expand. Identity on the left, key
          stats on the right. Secondary stats (KB/Mouse/Intervals) move
          into the expanded body so the header doesn't overflow. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:bg-muted/30',
          expanded && 'border-b border-border/60',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              !expanded && '-rotate-90',
            )}
            strokeWidth={2.2}
          />
          <Avatar
            url={userInfo?.avatarUrl}
            name={activity.userName || activity.userEmail}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {activity.userName || 'User'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {userInfo?.employeeId && (
                <>
                  <span className="font-medium text-primary">
                    {userInfo.employeeId}
                  </span>
                  <span className="mx-1">·</span>
                </>
              )}
              {activity.userEmail}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HeaderStat
            icon={Clock}
            label="Active"
            value={formatDuration(activity.totalActiveMinutes / 60)}
            tone="good"
          />
          <HeaderStat
            icon={PauseCircle}
            label="Idle"
            value={formatDuration(activity.totalIdleMinutes / 60)}
            tone="mid"
          />
          <HeaderStat
            icon={Gauge}
            label="Score"
            value={`${scorePercent}%`}
            tone={scoreTone}
          />
        </div>
      </button>

      {expanded && (
        <div className="animate-fade-in">
          {/* Secondary stats row — tinted icon badges per metric so the
              row reads as distinct tiles, not a uniform strip. */}
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 bg-muted/30">
            <SecondaryStat
              icon={Keyboard}
              label="Keystrokes"
              value={totalKeyboard.toLocaleString()}
              tint="indigo"
            />
            <SecondaryStat
              icon={Mouse}
              label="Mouse events"
              value={totalMouse.toLocaleString()}
              tint="fuchsia"
            />
            <SecondaryStat
              icon={Layers}
              label="Intervals"
              value={String(activity.bucketCount)}
              tint="sky"
            />
          </div>

          {/* Charts — wrapped in a light surface so the two panes read as
              a matched pair rather than floating on the muted background. */}
          {appData.length > 0 && (
            <div className="grid grid-cols-1 gap-px border-b border-border/60 bg-border/60 md:grid-cols-2">
              {/* App usage */}
              <div className="flex flex-col gap-3 bg-card p-5 sm:p-6">
                <ChartHeader label="App usage" suffix="hours" />
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, appData.length * 34)}
                >
                  <BarChart
                    data={appData}
                    layout="vertical"
                    margin={{ left: 0, right: 12, top: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.05)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11, fontWeight: 600 }}
                      width={110}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.08)',
                        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.12)',
                      }}
                      formatter={(v) => `${v}h`}
                    />
                    <Bar
                      dataKey="hours"
                      radius={[0, 6, 6, 0]}
                      animationDuration={700}
                    >
                      {appData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Active vs Idle donut + central label */}
              <div className="flex flex-col gap-3 bg-card p-5 sm:p-6">
                <ChartHeader label="Active vs Idle" suffix="minutes" />
                <div className="relative mx-auto w-full max-w-[260px]">
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
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="transparent"
                        animationDuration={700}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 10,
                          border: '1px solid rgba(0,0,0,0.08)',
                          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.12)',
                        }}
                        formatter={(v) => `${v}m`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central ratio label — sits in the donut hole */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                      {Math.round(
                        (activity.totalActiveMinutes /
                          Math.max(
                            1,
                            activity.totalActiveMinutes +
                              activity.totalIdleMinutes,
                          )) *
                          100,
                      )}
                      <span className="text-base font-semibold text-muted-foreground">
                        %
                      </span>
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      active
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-center gap-5 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-foreground">
                      Active
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {Math.round(activity.totalActiveMinutes)}m
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="font-semibold text-foreground">Idle</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
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

          {/* AI Summary — sits on a soft tinted surface when a summary
              exists, flat when empty. The top hairline is a gradient so
              the block reads as a deliberate, distinct section. */}
          <div
            className={cn(
              'relative space-y-4 p-5 sm:p-6',
              summary &&
                'bg-gradient-to-br from-primary/[0.03] via-card to-accent/[0.03]',
            )}
          >
            {summary && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
              />
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" />
                AI work summary
              </div>
              <Button
                variant={summary ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                className="h-8 gap-1.5 text-xs"
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
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {generateMutation.isPending
                    ? 'Analysing activity data — headline, themes, and concerns usually take 10–30 seconds.'
                    : 'Click Generate summary for an AI narrative of this work session. It covers what apps were used, focus patterns, and any concerns.'}
                </p>
              </div>
            )}

            {generateMutation.error && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : 'Failed to generate summary'}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

/* ═══ Header stat — compact icon + value + label ═══ */

const TONE_STYLES: Record<
  'good' | 'mid' | 'low',
  { icon: string; value: string }
> = {
  good: { icon: 'text-emerald-600 bg-emerald-50', value: 'text-emerald-700' },
  mid: { icon: 'text-amber-700 bg-amber-50', value: 'text-amber-700' },
  low: { icon: 'text-destructive bg-destructive/10', value: 'text-destructive' },
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  tone: 'good' | 'mid' | 'low'
}) {
  const s = TONE_STYLES[tone]
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg',
          s.icon,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="leading-tight">
        <p className={cn('text-sm font-bold tabular-nums', s.value)}>{value}</p>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
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
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-1 rounded-full bg-gradient-to-b from-primary to-accent" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
          {label}
        </p>
      </div>
      {suffix && (
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
  tint = 'indigo',
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  tint?: 'indigo' | 'fuchsia' | 'sky'
}) {
  const tintClass = {
    indigo: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20 dark:text-fuchsia-300',
    sky: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300',
  }[tint]
  return (
    <div className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-background/60">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm transition-transform duration-300 group-hover:scale-110',
          tintClass,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-mono text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  )
}

/* ═══ AI Summary display ═══ */

function SummaryDisplay({ summary }: { summary: DailySummary }) {
  const pct = Math.max(0, Math.min(100, summary.productivityScore * 10))
  const prodColor =
    summary.productivityScore >= 7
      ? '[&>div]:!bg-emerald-500'
      : summary.productivityScore >= 4
        ? '[&>div]:!bg-amber-500'
        : '[&>div]:!bg-destructive'

  return (
    <div className="space-y-4">
      {/* Narrative — sits on a slightly elevated card so it reads as the
          hero of the section, not just a paragraph. */}
      <p className="text-[14px] leading-relaxed text-foreground/90">
        {summary.summary}
      </p>

      {summary.keyActivities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.keyActivities.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <span className="h-1 w-1 rounded-full bg-primary" />
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Productivity
          </span>
          <Progress
            value={pct}
            className={cn('h-2 w-32 overflow-hidden rounded-full', prodColor)}
          />
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">
            {summary.productivityScore}
            <span className="text-xs font-semibold text-muted-foreground">
              {' '}/10
            </span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5" />
          Generated{' '}
          {new Date(summary.generatedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {summary.concerns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.concerns.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
