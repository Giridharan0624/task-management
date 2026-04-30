'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
  Sector,
} from 'recharts'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useHasPermission } from '@/lib/hooks/usePermission'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/Tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ReportsPeriodNav,
  type Period,
} from '@/components/reports/ReportsPeriodNav'
import { ReportsStatStrip } from '@/components/reports/ReportsStatStrip'
import { ActivityReport } from '@/components/reports/ActivityReport'
import { formatDuration } from '@/lib/utils/formatDuration'
import { buildCsvName } from '@/lib/utils/csvFilename'
import type { Attendance } from '@/types/attendance'
import { cn } from '@/lib/utils'

type ReportView = 'summary' | 'detailed' | 'weekly' | 'activity'

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a78bfa',
  '#c084fc',
  '#f472b6',
  '#fb7185',
  '#f97316',
  '#facc15',
  '#34d399',
  '#2dd4bf',
  '#38bdf8',
  '#818cf8',
]

/** Recharts v3 removed activeIndex/activeShape from Pie's public types but still supports them at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pieInteractiveProps(activeIndex: number): any {
  return {
    activeIndex,
    activeShape: (props: {
      cx: number
      cy: number
      innerRadius: number
      outerRadius: number
      startAngle: number
      endAngle: number
      fill: string
    }) => (
      <g>
        <Sector
          cx={props.cx}
          cy={props.cy}
          innerRadius={props.innerRadius}
          outerRadius={props.outerRadius + 6}
          startAngle={props.startAngle}
          endAngle={props.endAngle}
          fill={props.fill}
        />
      </g>
    ),
  }
}

function slugId(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, '_')
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function getDateRange(period: Period, offset: number) {
  const now = new Date()
  if (period === 'daily') {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    const iso = d.toISOString().slice(0, 10)
    return {
      start: iso,
      end: iso,
      label: d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    }
  }
  if (period === 'weekly') {
    const d = new Date(now)
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
    const mon = new Date(d)
    const sun = new Date(d)
    sun.setDate(sun.getDate() + 6)
    return {
      start: mon.toISOString().slice(0, 10),
      end: sun.toISOString().slice(0, 10),
      label: `${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    }
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: d.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
  }
}

function getWeekDates(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const d = new Date(now)
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d)
    dd.setDate(dd.getDate() + i)
    dates.push(dd.toISOString().slice(0, 10))
  }
  const mon = new Date(d)
  const sun = new Date(d)
  sun.setDate(sun.getDate() + 6)
  return {
    dates,
    start: dates[0],
    end: dates[6],
    label: `${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

function getDatesBetween(start: string, end: string) {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatDayLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
  })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [view, setView] = useState<ReportView>('summary')

  // Separate state for each view — switching views no longer pollutes the other
  const [summaryPeriod, setSummaryPeriod] = useState<Period>('weekly')
  const [summaryOffset, setSummaryOffset] = useState(0)
  const [detailedPeriod, setDetailedPeriod] = useState<Period>('weekly')
  const [detailedOffset, setDetailedOffset] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)

  const [memberFilter, setMemberFilter] = useState<string>('ALL')

  // Reports show team-wide data when the caller has progress-view.
  // Falls back to the legacy role check during the roles-fetch window.
  const canViewTeamProgress = useHasPermission('user.progress.view')
  const legacyPrivileged =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const isPrivileged =
    canViewTeamProgress === null ? legacyPrivileged : canViewTeamProgress

  // Summary view data
  const summaryRange = useMemo(
    () => getDateRange(summaryPeriod, summaryOffset),
    [summaryPeriod, summaryOffset]
  )
  const { data: summaryRaw, isLoading: summaryLoading } = useAttendanceReport(
    summaryRange.start,
    summaryRange.end
  )

  // Detailed view data
  const detailedRange = useMemo(
    () => getDateRange(detailedPeriod, detailedOffset),
    [detailedPeriod, detailedOffset]
  )
  const { data: detailedRaw, isLoading: detailedLoading } = useAttendanceReport(
    detailedRange.start,
    detailedRange.end
  )

  // Weekly view data
  const weekData = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const { data: weekRecords, isLoading: weekLoading } = useAttendanceReport(
    weekData.start,
    weekData.end
  )

  const summaryRecords = useMemo(() => {
    if (!summaryRaw) return []
    return memberFilter === 'ALL'
      ? summaryRaw
      : summaryRaw.filter((r) => r.userId === memberFilter)
  }, [summaryRaw, memberFilter])

  const detailedRecords = useMemo(() => {
    if (!detailedRaw) return []
    return memberFilter === 'ALL'
      ? detailedRaw
      : detailedRaw.filter((r) => r.userId === memberFilter)
  }, [detailedRaw, memberFilter])

  const filteredWeekRecords = useMemo(() => {
    if (!weekRecords) return []
    return memberFilter === 'ALL'
      ? weekRecords
      : weekRecords.filter((r) => r.userId === memberFilter)
  }, [weekRecords, memberFilter])

  const memberOptions = useMemo(() => {
    const map = new Map<string, string>()
    // Aggregate member names from whichever dataset is loaded
    for (const r of summaryRaw ?? []) map.set(r.userId, r.userName || r.userEmail)
    for (const r of detailedRaw ?? []) map.set(r.userId, r.userName || r.userEmail)
    for (const r of weekRecords ?? []) map.set(r.userId, r.userName || r.userEmail)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [summaryRaw, detailedRaw, weekRecords])

  if (!isPrivileged) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view reports.
        </p>
      </div>
    )
  }

  const memberFilterLabel =
    memberFilter === 'ALL'
      ? 'All members'
      : memberOptions.find((m) => m.id === memberFilter)?.name ?? 'Member'

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Time Reports"
        description="Track hours, analyze productivity, and export data"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1.5">
                {memberFilter === 'ALL' ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                <span className="max-w-[140px] truncate font-semibold">
                  {memberFilterLabel}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Filter by member</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={memberFilter}
                onValueChange={setMemberFilter}
              >
                <DropdownMenuRadioItem value="ALL">
                  All members
                </DropdownMenuRadioItem>
                {memberOptions.map((m) => (
                  <DropdownMenuRadioItem key={m.id} value={m.id}>
                    {m.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <WeeklyRollupPromo />

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as ReportView)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="detailed">Detailed</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ═══ Summary ═══ */}
        <TabsContent value="summary" className="flex flex-col gap-5">
          <ReportsPeriodNav
            period={summaryPeriod}
            onPeriodChange={setSummaryPeriod}
            offset={summaryOffset}
            onOffsetChange={setSummaryOffset}
            label={summaryRange.label}
          />
          <SummaryView
            records={summaryRecords}
            isLoading={summaryLoading}
            period={summaryPeriod}
            start={summaryRange.start}
            end={summaryRange.end}
          />
        </TabsContent>

        {/* ═══ Detailed ═══ */}
        <TabsContent value="detailed" className="flex flex-col gap-5">
          <ReportsPeriodNav
            period={detailedPeriod}
            onPeriodChange={setDetailedPeriod}
            offset={detailedOffset}
            onOffsetChange={setDetailedOffset}
            label={detailedRange.label}
          />
          <DetailedView
            records={detailedRecords}
            isLoading={detailedLoading}
            rangeStart={detailedRange.start}
            rangeEnd={detailedRange.end}
          />
        </TabsContent>

        {/* ═══ Weekly ═══ */}
        <TabsContent value="weekly" className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="h-8 w-8"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[220px] text-center text-sm font-semibold text-foreground">
              {weekData.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((o) => o + 1)}
              disabled={weekOffset >= 0}
              className="h-8 w-8"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setWeekOffset(0)}
                className="h-auto"
              >
                This week
              </Button>
            )}
          </div>
          <WeeklyView
            records={filteredWeekRecords}
            dates={weekData.dates}
            isLoading={weekLoading}
          />
        </TabsContent>

        {/* ═══ Activity ═══ */}
        <TabsContent value="activity">
          <ActivityReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ═════════════════ Summary View ═════════════════ */

function SummaryView({
  records,
  isLoading,
  period,
  start,
  end,
}: {
  records: Attendance[]
  isLoading: boolean
  period: Period
  start: string
  end: string
}) {
  const [activePieIndex, setActivePieIndex] = useState<number>(-1)

  const projectHoursMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records)
      for (const s of r.sessions) {
        const p = s.projectName || 'No Project'
        map.set(p, (map.get(p) ?? 0) + (s.hours ?? 0))
      }
    return map
  }, [records])

  const allProjects = useMemo(
    () => Array.from(projectHoursMap.keys()).sort(),
    [projectHoursMap]
  )
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {}
    allProjects.forEach((p, i) => {
      m[p] = COLORS[i % COLORS.length]
    })
    return m
  }, [allProjects])

  const stackedBarData = useMemo(() => {
    if (period === 'daily') {
      const memberMap = new Map<string, Record<string, number>>()
      for (const r of records) {
        const name = (r.userName || r.userEmail).split(' ')[0]
        if (!memberMap.has(name)) memberMap.set(name, {})
        for (const s of r.sessions) {
          const p = s.projectName || 'No Project'
          memberMap.get(name)![p] = (memberMap.get(name)![p] ?? 0) + (s.hours ?? 0)
        }
      }
      return Array.from(memberMap.entries()).map(([name, cats]) => {
        const entry: Record<string, string | number> = { date: name }
        for (const p of allProjects)
          entry[p] = Math.round((cats[p] ?? 0) * 100) / 100
        return entry
      })
    }
    const dates = getDatesBetween(start, end)
    const dateMap = new Map<string, Record<string, number>>()
    for (const d of dates) dateMap.set(d, {})
    for (const r of records) {
      const de = dateMap.get(r.date)
      if (!de) continue
      for (const s of r.sessions) {
        const p = s.projectName || 'No Project'
        de[p] = (de[p] ?? 0) + (s.hours ?? 0)
      }
    }
    return dates.map((d) => {
      const entry: Record<string, string | number> = { date: formatDayLabel(d) }
      for (const p of allProjects)
        entry[p] = Math.round((dateMap.get(d)![p] ?? 0) * 100) / 100
      return entry
    })
  }, [records, start, end, period, allProjects])

  const pieData = useMemo(
    () =>
      Array.from(projectHoursMap.entries())
        .map(([name, value]) => ({
          name,
          value: Math.round(value * 100) / 100,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [projectHoursMap]
  )

  const totalHours = useMemo(
    () =>
      records.reduce(
        (s, r) =>
          s + (r.sessions?.reduce((ss, se) => ss + (se.hours ?? 0), 0) ?? 0),
        0
      ),
    [records]
  )
  const totalMembers = useMemo(
    () => new Set(records.map((r) => r.userId)).size,
    [records]
  )
  const totalSessions = useMemo(
    () => records.reduce((s, r) => s + (r.sessions?.length ?? 0), 0),
    [records]
  )

  // Integer percentages per project, summing to exactly 100 (largest-remainder method).
  const percentageMap = useMemo(() => {
    const map: Record<string, number> = {}
    if (totalHours <= 0) {
      for (const p of allProjects) map[p] = 0
      return map
    }
    const items = allProjects.map((p) => {
      const exact = ((projectHoursMap.get(p) ?? 0) / totalHours) * 100
      return { name: p, floor: Math.floor(exact), rem: exact - Math.floor(exact) }
    })
    const leftover = 100 - items.reduce((s, it) => s + it.floor, 0)
    const ordered = [...items].sort((a, b) => b.rem - a.rem)
    for (let i = 0; i < leftover && i < ordered.length; i++) ordered[i].floor += 1
    for (const it of items) map[it.name] = it.floor
    return map
  }, [allProjects, projectHoursMap, totalHours])

  const topTasks = useMemo(() => {
    const map = new Map<
      string,
      { name: string; project: string; hours: number }
    >()
    for (const r of records)
      for (const s of r.sessions) {
        const key = `${s.taskTitle || 'General'}::${s.projectName || ''}`
        const ex = map.get(key)
        if (ex) ex.hours += s.hours ?? 0
        else
          map.set(key, {
            name: s.taskTitle || 'General',
            project: s.projectName || 'No Project',
            hours: s.hours ?? 0,
          })
      }
    return Array.from(map.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
  }, [records])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={
          <Clock
            className="h-7 w-7 text-muted-foreground/70"
            strokeWidth={1.5}
          />
        }
        title="No time data"
        description="Nothing was logged in the selected period. Try a different date range."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ReportsStatStrip
        totalHoursLabel={formatDuration(totalHours)}
        members={totalMembers}
        sessions={totalSessions}
        projects={allProjects.length}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 stagger-up">
        {/* Bar chart */}
        <Card className="relative overflow-hidden p-5 hover-lift-sm">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            aria-hidden
          />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Hours by project
                <span className="font-normal text-muted-foreground">
                  {' '}
                  — {period === 'daily' ? 'per member' : 'per day'}
                </span>
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                Across {allProjects.length}{' '}
                {allProjects.length === 1 ? 'project' : 'projects'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Total
              </p>
              <p className="text-lg font-bold leading-tight tabular-nums text-foreground">
                {formatDuration(totalHours)}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={stackedBarData}
              margin={{ left: -8, right: 8, top: 8, bottom: 0 }}
              barCategoryGap="22%"
            >
              <defs>
                {allProjects.map((p) => (
                  <linearGradient
                    key={p}
                    id={`rp-bargrad-${slugId(p)}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={colorMap[p]} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={colorMap[p]} stopOpacity={0.55} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="4 6"
                stroke="currentColor"
                strokeOpacity={0.08}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                interval={period === 'monthly' ? 2 : 0}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
                tickFormatter={(v: number) => (v > 0 ? formatDuration(v) : '0')}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                content={<CustomBarTooltip />}
              />
              {allProjects.map((p, i) => (
                <Bar
                  key={p}
                  dataKey={p}
                  stackId="h"
                  fill={`url(#rp-bargrad-${slugId(p)})`}
                  radius={i === allProjects.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={44}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4">
            {allProjects.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorMap[p] }}
                />
                <span className="text-xs font-medium text-foreground/85">{p}</span>
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground/70">
                  {percentageMap[p] ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pie chart */}
        <Card className="relative overflow-hidden p-5 hover-lift-sm">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
            aria-hidden
          />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Distribution
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                Hours by project
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Entries
              </p>
              <p className="text-lg font-bold leading-tight tabular-nums text-foreground">
                {pieData.length}
              </p>
            </div>
          </div>
          {pieData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No data</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={98}
                      paddingAngle={pieData.length > 1 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                      onMouseEnter={(_, i) => setActivePieIndex(i)}
                      onMouseLeave={() => setActivePieIndex(-1)}
                      {...pieInteractiveProps(activePieIndex)}
                    >
                      {pieData.map((e) => (
                        <Cell key={e.name} fill={colorMap[e.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    {/* No <Tooltip> — the centre label + highlighted
                        legend row already show hover state cleanly. A
                        floating tooltip on top of the centre card
                        produced stacked duplicate text (SELECTED, name,
                        duration twice, percent, name again). */}
                  </PieChart>
                </ResponsiveContainer>
                {/* Centre label — sole source of hover feedback inside
                    the donut. Shows TOTAL at rest, SELECTED + duration
                    + percentage + project name on hover. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                    {activePieIndex >= 0 ? 'Selected' : 'Total'}
                  </span>
                  <span className="mt-1 text-base font-bold leading-tight tabular-nums text-foreground">
                    {activePieIndex >= 0
                      ? formatDuration(pieData[activePieIndex].value)
                      : formatDuration(totalHours)}
                  </span>
                  {activePieIndex >= 0 && (
                    <>
                      <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-primary">
                        {percentageMap[pieData[activePieIndex].name] ?? 0}%
                      </span>
                      <span className="mt-1 max-w-[120px] truncate px-2 text-[10px] text-muted-foreground/80">
                        {pieData[activePieIndex].name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* Custom legend */}
              <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
                {pieData.map((entry, i) => {
                  const pct = percentageMap[entry.name] ?? 0
                  const isActive = activePieIndex === i
                  return (
                    <div
                      key={entry.name}
                      onMouseEnter={() => setActivePieIndex(i)}
                      onMouseLeave={() => setActivePieIndex(-1)}
                      className={cn(
                        'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors',
                        isActive ? 'bg-muted/70' : 'hover:bg-muted/40'
                      )}
                    >
                      <span
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full transition-transform',
                          isActive && 'scale-125'
                        )}
                        style={{ backgroundColor: colorMap[entry.name] || COLORS[0] }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground/90">
                          {entry.name}
                        </p>
                        <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/70">
                          {formatDuration(entry.value)}
                        </p>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground/85">
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {topTasks.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-foreground">
              Top tasks by time
            </h3>
          </div>
          <ul className="divide-y divide-border/60">
            {topTasks.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-2.5"
              >
                <span className="w-5 shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.project}
                  </p>
                </div>
                <Progress
                  value={totalHours > 0 ? (t.hours / totalHours) * 100 : 0}
                  className="h-1.5 w-24 shrink-0"
                />
                <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                  {formatDuration(t.hours)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <MemberBreakdown records={records} totalHours={totalHours} />
    </div>
  )
}

function CustomBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value > 0)
  if (!items.length) return null
  const total = items.reduce((s, p) => s + p.value, 0)
  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {items.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="flex-1 text-muted-foreground">{p.name}</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatDuration(p.value)}
          </span>
        </div>
      ))}
      {items.length > 1 && (
        <div className="mt-1.5 flex justify-between border-t border-border pt-1.5">
          <span className="font-semibold text-foreground/85">Total</span>
          <span className="font-bold tabular-nums text-primary">
            {formatDuration(total)}
          </span>
        </div>
      )}
    </div>
  )
}

function MemberBreakdown({
  records,
  totalHours,
}: {
  records: Attendance[]
  totalHours: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string
        name: string
        hours: number
        sessions: {
          date: string
          signInAt: string
          signOutAt: string | null
          hours: number | null
          taskTitle: string
          projectName: string
          description: string
        }[]
      }
    >()
    for (const r of records) {
      const sessions = r.sessions.map((s) => ({
        date: r.date,
        signInAt: s.signInAt,
        signOutAt: s.signOutAt,
        hours: s.hours,
        taskTitle: s.taskTitle || 'General',
        projectName: s.projectName || 'No Project',
        description: s.description || '',
      }))
      const ex = map.get(r.userId)
      if (ex) {
        ex.hours += sessions.reduce((s, se) => s + (se.hours ?? 0), 0)
        ex.sessions.push(...sessions)
      } else
        map.set(r.userId, {
          userId: r.userId,
          name: r.userName || r.userEmail || r.userId,
          hours: sessions.reduce((s, se) => s + (se.hours ?? 0), 0),
          sessions,
        })
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-bold text-foreground">
          Member breakdown
        </h3>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row, i) => {
          const isOpen = expanded.has(row.userId)
          const pct =
            totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0
          return (
            <div key={row.userId}>
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const n = new Set(prev)
                    if (n.has(row.userId)) n.delete(row.userId)
                    else n.add(row.userId)
                    return n
                  })
                }
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90'
                  )}
                />
                <div className="flex min-w-[120px] items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {row.name}
                  </span>
                </div>
                <span className="min-w-[70px] text-right text-xs font-semibold tabular-nums text-foreground">
                  {formatDuration(row.hours)}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="bg-muted/30 px-5 pb-3">
                  <div className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Date</span>
                    <span>Project</span>
                    <span>Task</span>
                    <span>Start</span>
                    <span>End</span>
                    <span className="text-right">Duration</span>
                  </div>
                  <div className="divide-y divide-border/80">
                    {row.sessions
                      .sort(
                        (a, b) =>
                          new Date(a.signInAt).getTime() -
                          new Date(b.signInAt).getTime()
                      )
                      .map((s, j) => (
                        <div
                          key={j}
                          className="py-2 text-[11px] transition-colors hover:bg-card/60"
                        >
                          <div className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2">
                            <span className="text-muted-foreground">
                              {formatDateShort(s.date)}
                            </span>
                            <span className="truncate font-medium text-foreground">
                              {s.projectName}
                            </span>
                            <span className="truncate text-muted-foreground">
                              {s.taskTitle}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {formatTime(s.signInAt)}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {s.signOutAt ? (
                                formatTime(s.signOutAt)
                              ) : (
                                <span className="font-sans font-medium text-emerald-600">
                                  Active
                                </span>
                              )}
                            </span>
                            <span className="text-right font-semibold tabular-nums text-foreground">
                              {s.hours != null ? formatDuration(s.hours) : '—'}
                            </span>
                          </div>
                          {s.description && (
                            <p className="ml-[90px] mt-0.5 text-[10px] italic text-muted-foreground">
                              — {s.description}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ═════════════════ Detailed View ═════════════════ */

function DetailedView({
  records,
  isLoading,
  rangeStart,
  rangeEnd,
}: {
  records: Attendance[]
  isLoading: boolean
  rangeStart: string
  rangeEnd: string
}) {
  const detailedRows = useMemo(() => {
    const rows: {
      date: string
      member: string
      project: string
      task: string
      description: string
      signIn: string
      signOut: string | null
      hours: number | null
    }[] = []
    for (const r of records)
      for (const s of r.sessions) {
        rows.push({
          date: r.date,
          member: r.userName || r.userEmail,
          project: s.projectName || 'No Project',
          task: s.taskTitle || 'General',
          description: s.description || '',
          signIn: s.signInAt,
          signOut: s.signOutAt,
          hours: s.hours,
        })
      }
    return rows.sort(
      (a, b) => new Date(b.signIn).getTime() - new Date(a.signIn).getTime()
    )
  }, [records])

  const totalHours = useMemo(
    () => detailedRows.reduce((s, r) => s + (r.hours ?? 0), 0),
    [detailedRows]
  )

  const memberGroups = useMemo(() => {
    const map = new Map<
      string,
      { member: string; totalHours: number; sessions: typeof detailedRows }
    >()
    for (const r of detailedRows) {
      const ex = map.get(r.member)
      if (ex) {
        ex.totalHours += r.hours ?? 0
        ex.sessions.push(r)
      } else
        map.set(r.member, {
          member: r.member,
          totalHours: r.hours ?? 0,
          sessions: [r],
        })
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalHours - a.totalHours
    )
  }, [detailedRows])

  const exportCSV = () => {
    const header = ['Date', 'Member', 'Project', 'Task', 'Start', 'End', 'Duration']
    const rows = detailedRows.map((r) => [
      r.date,
      r.member,
      r.project,
      r.task,
      formatTime(r.signIn),
      r.signOut ? formatTime(r.signOut) : 'Active',
      r.hours != null ? formatDuration(r.hours) : '—',
    ])
    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = buildCsvName('time-report', rangeStart, rangeEnd)
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-foreground">Time log</h3>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {detailedRows.length} entries
          </span>
          <span className="text-[11px] text-muted-foreground">
            Total:{' '}
            <strong className="text-foreground">
              {formatDuration(totalHours)}
            </strong>
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCSV}
          disabled={detailedRows.length === 0}
          className="gap-1.5"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {memberGroups.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={
              <Clock
                className="h-7 w-7 text-muted-foreground/70"
                strokeWidth={1.5}
              />
            }
            title="No sessions"
            description="Nothing was logged in this period."
            className="border-0 py-6"
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {memberGroups.map((g) => (
            <DetailedMemberGroup key={g.member} group={g} />
          ))}
        </div>
      )}
    </Card>
  )
}

function DetailedMemberGroup({
  group,
}: {
  group: {
    member: string
    totalHours: number
    sessions: {
      date: string
      project: string
      task: string
      description: string
      signIn: string
      signOut: string | null
      hours: number | null
    }[]
  }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className="flex-1 text-sm font-semibold text-foreground">
          {group.member}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {group.sessions.length} session
          {group.sessions.length !== 1 ? 's' : ''}
        </span>
        <span className="min-w-[80px] text-right text-sm font-bold tabular-nums text-primary">
          {formatDuration(group.totalHours)}
        </span>
      </button>
      {open && (
        <div className="bg-muted/30 px-5 pb-3">
          <div className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px] gap-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Date</span>
            <span>Project</span>
            <span>Task</span>
            <span>Start</span>
            <span>End</span>
            <span className="text-right">Duration</span>
          </div>
          <div className="divide-y divide-border/80">
            {group.sessions.map((s, i) => (
              <div key={i} className="py-2 text-[11px]">
                <div className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px] gap-2">
                  <span className="text-muted-foreground">
                    {formatDateShort(s.date)}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {s.project}
                  </span>
                  <span className="truncate font-medium text-foreground">
                    {s.task}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatTime(s.signIn)}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {s.signOut ? (
                      formatTime(s.signOut)
                    ) : (
                      <span className="font-sans font-medium text-emerald-600">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-foreground">
                    {s.hours != null ? formatDuration(s.hours) : '—'}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-0.5 text-[10px] italic text-muted-foreground">
                    — {s.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═════════════════ Weekly View ═════════════════ */

function WeeklyView({
  records,
  dates,
  isLoading,
}: {
  records: Attendance[]
  dates: string[]
  isLoading: boolean
}) {
  const weeklyGrid = useMemo(() => {
    const memberMap = new Map<
      string,
      { name: string; days: Record<string, number> }
    >()
    for (const r of records) {
      if (!memberMap.has(r.userId))
        memberMap.set(r.userId, {
          name: r.userName || r.userEmail,
          days: {},
        })
      const entry = memberMap.get(r.userId)!
      const hrs = r.sessions.reduce((s, se) => s + (se.hours ?? 0), 0)
      entry.days[r.date] = (entry.days[r.date] ?? 0) + hrs
    }
    return Array.from(memberMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [records])

  const weekTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const d of dates) totals[d] = 0
    for (const m of weeklyGrid)
      for (const [d, h] of Object.entries(m.days))
        totals[d] = (totals[d] ?? 0) + h
    return totals
  }, [weeklyGrid, dates])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  const today = todayISO()

  return (
    <Card className="overflow-hidden p-0">
      {/* Member-hours table runs 5+ wide columns; force horizontal scroll
          on phones rather than letting it overflow the card. */}
      <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Member</TableHead>
            {dates.map((d) => {
              const isToday = d === today
              return (
                <TableHead
                  key={d}
                  className={cn(
                    'text-center',
                    isToday && 'bg-primary/10 text-primary'
                  )}
                >
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short',
                  })}
                  <br />
                  <span className="text-[9px] font-semibold">
                    {new Date(d + 'T00:00:00').getDate()}
                  </span>
                </TableHead>
              )
            })}
            <TableHead className="bg-muted/40 text-center text-foreground">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeklyGrid.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No data this week
              </TableCell>
            </TableRow>
          ) : (
            weeklyGrid.map((m) => {
              const memberTotal = Object.values(m.days).reduce(
                (s, h) => s + h,
                0
              )
              return (
                <TableRow key={m.name}>
                  <TableCell className="font-medium text-foreground">
                    {m.name}
                  </TableCell>
                  {dates.map((d) => {
                    const hrs = m.days[d] ?? 0
                    const isToday = d === today
                    return (
                      <TableCell
                        key={d}
                        className={cn(
                          'text-center tabular-nums',
                          isToday && 'bg-primary/5',
                          hrs > 0
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground/50'
                        )}
                      >
                        {hrs > 0 ? formatDuration(hrs) : '—'}
                      </TableCell>
                    )
                  })}
                  <TableCell className="bg-muted/30 text-center font-bold tabular-nums text-primary">
                    {formatDuration(memberTotal)}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
        {weeklyGrid.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold text-foreground">Total</TableCell>
              {dates.map((d) => {
                const t = weekTotals[d] ?? 0
                return (
                  <TableCell
                    key={d}
                    className="text-center font-bold tabular-nums text-foreground"
                  >
                    {t > 0 ? formatDuration(t) : '—'}
                  </TableCell>
                )
              })}
              <TableCell className="bg-muted/50 text-center font-black tabular-nums text-primary">
                {formatDuration(
                  Object.values(weekTotals).reduce((s, h) => s + h, 0)
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Weekly rollup promo — a compact banner above the tabs pointing owners at
// the AI-assisted digest. It's separate from the tabbed reports because the
// rollup pulls from task updates (daily standups), not the attendance data
// the existing tabs render.
// ═══════════════════════════════════════════════════════════════════════════

function WeeklyRollupPromo() {
  return (
    <Link
      href="/reports/weekly"
      className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.06] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-colors group-hover:bg-primary/20"
      />
      <div className="relative flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/20">
          <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            Weekly rollup
            <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              AI
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            An editorial summary of every task update from the last seven days —
            top contributors, themes, and things worth flagging.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          View
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
