'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, FileDown, Calendar as CalendarIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { LiveDot } from '@/components/ui/LiveDot'
import { Progress } from '@/components/ui/Progress'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'
import { AttendanceMonthNav } from '@/components/attendance/AttendanceMonthNav'
import {
  useAttendanceReport,
  useMyAttendance,
} from '@/lib/hooks/useAttendance'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import { buildCsvName } from '@/lib/utils/csvFilename'
import type { Attendance } from '@/types/attendance'
import { cn } from '@/lib/utils'

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, daysInMonth: lastDay }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getRecordHours(r: Attendance): number {
  return r.sessions.reduce((s, se) => s + getSessionHours(se), 0)
}

function generateCSV(records: Attendance[]): string {
  const rows: string[][] = [
    ['Date', 'Session #', 'Task', 'Project', 'Description', 'Start', 'End', 'Duration'],
  ]
  for (const r of records) {
    for (let i = 0; i < r.sessions.length; i++) {
      const s = r.sessions[i]
      rows.push([
        r.date,
        String(i + 1),
        s.taskTitle || 'General',
        s.projectName || '-',
        s.description || '',
        formatTime(s.signInAt),
        s.signOutAt ? formatTime(s.signOutAt) : 'Active',
        formatDuration(getSessionHours(s)),
      ])
    }
  }
  return rows
    .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

/**
 * Full-page attendance view for members. The /attendance/report endpoint
 * scopes to the caller's own records when the caller lacks
 * `ATTENDANCE_REPORT_VIEW`, so we can reuse the team hook and render a
 * self-focused UI without needing any admin-only calls.
 */
export function MyAttendanceView() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const { start, end, daysInMonth } = getMonthRange(selectedYear, selectedMonth)
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)
  const { data: myAttendance } = useMyAttendance()
  const hasActiveSession = myAttendance?.status === 'SIGNED_IN'

  // Live tick while a session is open so durations update in realtime.
  const [, setTick] = useState(0)
  useEffect(() => {
    const anyActive =
      hasActiveSession ||
      (rawRecords ?? []).some((r) => r.sessions.some((s) => !s.signOutAt))
    if (!anyActive) return
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [hasActiveSession, rawRecords])

  const records = useMemo(() => rawRecords ?? [], [rawRecords])

  const totalHours = useMemo(
    () => records.reduce((s, r) => s + getRecordHours(r), 0),
    [records],
  )
  const totalSessions = useMemo(
    () => records.reduce((s, r) => s + r.sessions.length, 0),
    [records],
  )
  const daysWorked = useMemo(
    () => new Set(records.map((r) => r.date)).size,
    [records],
  )
  const avgPerDay = daysWorked > 0 ? totalHours / daysWorked : 0

  /** Hours per day-of-month — index 0 is day 1, length = daysInMonth. */
  const dailyHours = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0) as number[]
    for (const r of records) {
      const dayIdx = new Date(r.date + 'T00:00:00').getDate() - 1
      if (dayIdx >= 0 && dayIdx < daysInMonth) {
        arr[dayIdx] += getRecordHours(r)
      }
    }
    return arr
  }, [records, daysInMonth])

  const maxDailyHours = useMemo(
    () => dailyHours.reduce((m, v) => Math.max(m, v), 0),
    [dailyHours],
  )

  const sortedDaily = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  )

  /** Aggregated hours per task across the month. */
  const taskStats = useMemo(() => {
    const map = new Map<
      string,
      { taskTitle: string; projectName: string; hours: number; sessions: number }
    >()
    for (const r of records) {
      for (const s of r.sessions) {
        const key = `${s.taskTitle || 'General'}::${s.projectName || '-'}`
        const hrs = getSessionHours(s)
        const ex = map.get(key)
        if (ex) {
          ex.hours += hrs
          ex.sessions += 1
        } else {
          map.set(key, {
            taskTitle: s.taskTitle || 'General',
            projectName: s.projectName || '-',
            hours: hrs,
            sessions: 1,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString(
    'en-US',
    { month: 'long', year: 'numeric' },
  )

  const handleDownload = () => {
    if (!records.length) return
    const csv = generateCSV(records)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName('my-attendance', start, end)
    a.click()
  }

  const statItems: StatCardItem[] = [
    {
      key: 'total',
      label: 'Total hours',
      value: formatDuration(totalHours),
      accent: 'text-indigo-700',
    },
    {
      key: 'days',
      label: 'Days worked',
      value: daysWorked,
      accent: 'text-violet-700',
    },
    {
      key: 'sessions',
      label: 'Sessions',
      value: totalSessions,
      accent: 'text-blue-700',
    },
    {
      key: 'avg',
      label: 'Avg / day',
      value: formatDuration(avgPerDay),
      accent: 'text-emerald-700',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title="My Attendance"
        description={monthLabel}
        actions={
          <div className="flex items-center gap-2">
            <AttendanceMonthNav
              year={selectedYear}
              month={selectedMonth}
              onChange={(y, m) => {
                setSelectedYear(y)
                setSelectedMonth(m)
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              disabled={!records.length}
              className="h-9 gap-1.5"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={
            <Clock
              className="h-7 w-7 text-muted-foreground/70"
              strokeWidth={1.5}
            />
          }
          title="No attendance yet"
          description={`You didn't clock in during ${monthLabel}. Start a session from the Desktop App to see data here.`}
        />
      ) : (
        <>
          <StatCardsGrid items={statItems} columns={4} />

          <MonthHeatmap
            year={selectedYear}
            month={selectedMonth}
            dailyHours={dailyHours}
            maxHours={maxDailyHours}
          />

          <Card className="overflow-hidden p-5">
            <Tabs defaultValue="daily" className="w-full">
              <TabsList>
                <TabsTrigger value="daily" className="gap-2">
                  Daily
                  <TabCount>{sortedDaily.length}</TabCount>
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-2">
                  Tasks
                  <TabCount>{taskStats.length}</TabCount>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="daily" className="mt-4">
                <div className="space-y-3">
                  {sortedDaily.map((r) => {
                    const hours = getRecordHours(r)
                    const anyActive = r.sessions.some((s) => !s.signOutAt)
                    return (
                      <div
                        key={r.date}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                      >
                        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2">
                          <span className="min-w-[110px] text-xs font-semibold tabular-nums text-foreground">
                            {formatDateLabel(r.date)}
                          </span>
                          <span className="flex-1 text-[11px] text-muted-foreground">
                            {r.sessions.length} session
                            {r.sessions.length !== 1 ? 's' : ''}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold tabular-nums',
                              anyActive ? 'text-emerald-600' : 'text-primary',
                            )}
                          >
                            {formatDuration(hours)}
                          </span>
                        </div>
                        <ul className="divide-y divide-border/60">
                          {r.sessions.map((s, i) => {
                            const active = !s.signOutAt
                            return (
                              <li key={i} className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                    {active && <LiveDot size="xs" />}
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {s.taskTitle || 'General'}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {s.projectName || '-'}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                                    {formatTime(s.signInAt)} –{' '}
                                    {s.signOutAt
                                      ? formatTime(s.signOutAt)
                                      : 'now'}
                                  </span>
                                  <span
                                    className={cn(
                                      'w-14 shrink-0 text-right text-[11px] font-bold tabular-nums',
                                      active
                                        ? 'text-emerald-600'
                                        : 'text-foreground',
                                    )}
                                  >
                                    {formatDuration(getSessionHours(s))}
                                  </span>
                                </div>
                                {s.description && (
                                  <p className="mt-0.5 pl-0.5 text-[10px] italic text-muted-foreground">
                                    — {s.description}
                                  </p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                {taskStats.length === 0 ? (
                  <EmptyState
                    title="No tasks logged"
                    description="No task time was logged this month."
                    className="border-0 py-6"
                  />
                ) : (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                    {taskStats.map((t) => {
                      const pct =
                        totalHours > 0
                          ? Math.round((t.hours / totalHours) * 100)
                          : 0
                      return (
                        <li
                          key={`${t.projectName}::${t.taskTitle}`}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {t.taskTitle}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {t.projectName} · {t.sessions} session
                              {t.sessions === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex w-32 shrink-0 flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {pct}%
                              </span>
                              <span className="text-xs font-bold tabular-nums text-primary">
                                {formatDuration(t.hours)}
                              </span>
                            </div>
                            <Progress value={pct} className="h-1" />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * Month-at-a-glance heatmap — one cell per day of the month, colored by
 * hours worked. Uses a consistent rounded-square grid that degrades
 * gracefully on small screens (wraps to fewer columns).
 */
function MonthHeatmap({
  year,
  month,
  dailyHours,
  maxHours,
}: {
  year: number
  month: number
  dailyHours: number[]
  maxHours: number
}) {
  const today = new Date()
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDay = today.getDate()

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Daily activity</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Max {maxHours > 0 ? formatDuration(maxHours) : '0h'} in a day
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(42px,1fr))]">
        {dailyHours.map((h, idx) => {
          const day = idx + 1
          const intensity = maxHours > 0 ? h / maxHours : 0
          const isToday = isCurrentMonth && day === todayDay
          const isFuture =
            isCurrentMonth && day > todayDay
          return (
            <div
              key={day}
              title={
                h > 0
                  ? `${day}: ${formatDuration(h)}`
                  : isFuture
                    ? `${day}: upcoming`
                    : `${day}: no activity`
              }
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border text-[10px] font-bold tabular-nums transition-all hover:scale-105',
                isFuture
                  ? 'border-dashed border-border/40 bg-transparent text-muted-foreground/40'
                  : h === 0
                    ? 'border-border bg-muted/40 text-muted-foreground/50'
                    : 'border-primary/20 text-primary-foreground',
                isToday && 'ring-2 ring-primary ring-offset-1',
              )}
              style={
                h > 0
                  ? {
                      backgroundColor: `rgb(var(--color-primary) / ${Math.max(0.2, intensity).toFixed(2)})`,
                    }
                  : undefined
              }
            >
              {day}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}
