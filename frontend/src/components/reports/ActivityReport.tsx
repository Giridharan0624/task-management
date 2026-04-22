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
          stats on the right. Secondary stats (KB/Mouse/Buckets) move
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
          {/* Secondary stats row */}
          <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 bg-muted/20">
            <SecondaryStat
              icon={Keyboard}
              label="Keystrokes"
              value={totalKeyboard.toLocaleString()}
            />
            <SecondaryStat
              icon={Mouse}
              label="Mouse events"
              value={totalMouse.toLocaleString()}
            />
            <SecondaryStat
              icon={Layers}
              label="Buckets"
              value={String(activity.bucketCount)}
            />
          </div>

          {/* Charts */}
          {appData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 border-b border-border/60 p-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  App usage (hours)
                </p>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, appData.length * 36)}
                >
                  <BarChart
                    data={appData}
                    layout="vertical"
                    margin={{ left: 10, right: 10, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 10 }}
                      width={110}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                      {appData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Active vs Idle
                </p>
                <ResponsiveContainer width="100%" height={160}>
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
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill="#34d399" />
                      <Cell fill="#fbbf24" />
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v) => `${v}m`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="-mt-2 flex justify-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Active {Math.round(activity.totalActiveMinutes)}m
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Idle {Math.round(activity.totalIdleMinutes)}m
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Screenshots timeline */}
          {activity.screenshots && activity.screenshots.length > 0 && (
            <ScreenshotGallery screenshots={activity.screenshots} />
          )}

          {/* AI Summary */}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  AI work summary
                </p>
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
              <p className="text-xs italic text-muted-foreground">
                {generateMutation.isPending
                  ? 'AI is analysing activity data…'
                  : 'Click "Generate summary" for an AI analysis of this work session.'}
              </p>
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

function SecondaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-bold tabular-nums text-foreground">
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
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-foreground/85">
        {summary.summary}
      </p>

      {summary.keyActivities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.keyActivities.map((a, i) => (
            <span
              key={i}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-[180px] items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Productivity
          </span>
          <Progress
            value={pct}
            className={cn('h-1.5 w-24 overflow-hidden rounded-full', prodColor)}
          />
          <span className="text-[11px] font-bold tabular-nums text-foreground">
            {summary.productivityScore}/10
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
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
