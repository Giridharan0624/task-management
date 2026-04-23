'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  ListChecks,
  PieChart as PieIcon,
  Target,
  Users,
} from 'lucide-react'

import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { useProjectStatus } from '@/lib/hooks/useProjects'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatDuration } from '@/lib/utils/formatDuration'
import { buildCsvName } from '@/lib/utils/csvFilename'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import type { Attendance } from '@/types/attendance'
import { cn } from '@/lib/utils'

/* ─────────────────────────────── theme ─────────────────────────────── */

type Period = 'weekly' | 'monthly' | 'all'

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
]

const STATUS_COLORS: Record<string, string> = {
  TODO: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  DEVELOPED: '#8b5cf6',
  TESTING: '#f97316',
  TESTED: '#14b8a6',
  DEBUGGING: '#ef4444',
  FINAL_TESTING: '#ec4899',
  DONE: '#10b981',
}

/* ─────────────────────────── time-range helpers ─────────────────────── */

function getRange(period: Period, offset: number) {
  const now = new Date()
  if (period === 'all') {
    return {
      start: '2020-01-01',
      end: now.toISOString().slice(0, 10),
      label: 'All time',
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
      label: `${mon.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })} – ${sun.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`,
    }
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: d.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  }
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
    day: 'numeric',
    month: 'short',
  })
}

/* ───────────────────────────── component ────────────────────────────── */

interface ProjectReportProps {
  projectId: string
  projectName: string
}

type ReportTab = 'overview' | 'workload' | 'sessions'

export function ProjectReport({ projectId, projectName }: ProjectReportProps) {
  const [period, setPeriod] = useState<Period>('weekly')
  const [offset, setOffset] = useState(0)
  const [tab, setTab] = useState<ReportTab>('overview')
  const [activePieIndex, setActivePieIndex] = useState<number>(-1)
  const labelOf = useStatusLabel()

  const { start, end, label } = useMemo(
    () => getRange(period, offset),
    [period, offset],
  )
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)
  const { data: projectStatus } = useProjectStatus(projectId)

  // Scope every record to the current project before any other math.
  const records: Attendance[] = useMemo(() => {
    if (!rawRecords) return []
    return rawRecords
      .map((r) => {
        const filtered = r.sessions.filter((s) => s.projectId === projectId)
        if (!filtered.length) return null
        return {
          ...r,
          sessions: filtered,
          totalHours: filtered.reduce((sum, s) => sum + (s.hours ?? 0), 0),
        }
      })
      .filter(Boolean) as Attendance[]
  }, [rawRecords, projectId])

  // ─── Metrics ───
  const totalHours = useMemo(
    () =>
      records.reduce(
        (s, r) => s + r.sessions.reduce((ss, se) => ss + (se.hours ?? 0), 0),
        0,
      ),
    [records],
  )
  const totalMembers = useMemo(
    () => new Set(records.map((r) => r.userId)).size,
    [records],
  )
  const totalSessions = useMemo(
    () => records.reduce((s, r) => s + r.sessions.length, 0),
    [records],
  )
  const totalEstimated = projectStatus?.totalEstimatedHours ?? 0
  const budgetPct =
    totalEstimated > 0 ? Math.round((totalHours / totalEstimated) * 100) : 0

  // ─── Hours by task ───
  const taskHours = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records)
      for (const s of r.sessions) {
        const t = s.taskTitle || 'General'
        map.set(t, (map.get(t) ?? 0) + (s.hours ?? 0))
      }
    return Array.from(map.entries())
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours)
  }, [records])

  const taskColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    taskHours.forEach((t, i) => {
      m[t.name] = CHART_COLORS[i % CHART_COLORS.length]
    })
    return m
  }, [taskHours])

  // ─── Hours by member ───
  const memberHours = useMemo(() => {
    const map = new Map<
      string,
      { name: string; hours: number; tasks: Map<string, number> }
    >()
    for (const r of records) {
      if (!map.has(r.userId))
        map.set(r.userId, {
          name: r.userName || r.userEmail,
          hours: 0,
          tasks: new Map(),
        })
      const entry = map.get(r.userId)!
      for (const s of r.sessions) {
        entry.hours += s.hours ?? 0
        const t = s.taskTitle || 'General'
        entry.tasks.set(t, (entry.tasks.get(t) ?? 0) + (s.hours ?? 0))
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  // ─── Status distribution ───
  const statusData = useMemo(() => {
    if (!projectStatus?.taskProgress) return []
    const counts = new Map<string, number>()
    for (const t of projectStatus.taskProgress)
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
    return Array.from(counts.entries()).map(([status, count]) => ({
      name: labelOf(status),
      value: count,
      status,
    }))
  }, [projectStatus, labelOf])

  // ─── Estimated vs Actual ───
  const estVsActual = useMemo(() => {
    if (!projectStatus?.taskProgress) return []
    return projectStatus.taskProgress
      .map((t) => ({
        name: t.title.length > 24 ? t.title.slice(0, 24) + '…' : t.title,
        fullName: t.title,
        estimated: t.estimatedHours ?? 0,
        tracked: t.trackedHours ?? 0,
        status: t.status,
      }))
      .filter((t) => t.estimated > 0 || t.tracked > 0)
  }, [projectStatus])

  // ─── Session log ───
  const detailedRows = useMemo(() => {
    const rows: {
      date: string
      member: string
      task: string
      signIn: string
      signOut: string | null
      hours: number | null
    }[] = []
    for (const r of records)
      for (const s of r.sessions) {
        rows.push({
          date: r.date,
          member: r.userName || r.userEmail,
          task: s.taskTitle || 'General',
          signIn: s.signInAt,
          signOut: s.signOutAt,
          hours: s.hours,
        })
      }
    return rows.sort(
      (a, b) => new Date(b.signIn).getTime() - new Date(a.signIn).getTime(),
    )
  }, [records])

  const exportCSV = () => {
    const header = ['Date', 'Member', 'Project', 'Task', 'Start', 'End', 'Duration']
    const rows = detailedRows.map((r) => [
      r.date,
      r.member,
      projectName,
      r.task,
      formatTime(r.signIn),
      r.signOut ? formatTime(r.signOut) : 'Active',
      r.hours != null ? formatDuration(r.hours) : '—',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName(`${projectName}-report`, start, end)
    a.click()
  }

  /* ─────────────────────────── render ─────────────────────────── */

  return (
    <div className="flex flex-col gap-5">
      {/* ───────── Toolbar ───────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
        {/* Period pills */}
        <div className="inline-flex rounded-xl border border-border/60 bg-muted/50 p-1">
          {(['weekly', 'monthly', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p)
                setOffset(0)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all',
                period === p
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p === 'all'
                ? 'All time'
                : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Period navigator */}
        {period !== 'all' ? (
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[180px] px-2 text-center text-[12px] font-semibold tabular-nums text-foreground">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                offset >= 0
                  ? 'cursor-not-allowed text-muted-foreground/40'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-[12px] font-semibold text-muted-foreground">
            {label}
          </div>
        )}

        {/* Export */}
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

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* ───────── Metric strip — pixel-grid mosaic ───────── */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-4">
            <MetricTile
              Icon={Clock}
              label="Tracked"
              value={formatDuration(totalHours)}
              tint="indigo"
            />
            <MetricTile
              Icon={Target}
              label="Budget"
              value={
                totalEstimated > 0 ? `${budgetPct}%` : '—'
              }
              hint={
                totalEstimated > 0
                  ? `${formatDuration(totalHours)} of ${formatDuration(totalEstimated)}`
                  : 'No estimates'
              }
              tint={budgetPct > 100 ? 'rose' : budgetPct > 80 ? 'amber' : 'emerald'}
            />
            <MetricTile
              Icon={Users}
              label="Members"
              value={String(totalMembers)}
              tint="violet"
            />
            <MetricTile
              Icon={ListChecks}
              label="Sessions"
              value={String(totalSessions)}
              tint="sky"
            />
          </div>

          {/* ───────── Inner tabs ───────── */}
          <div className="flex items-center gap-1 border-b border-border/60">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'workload', label: `Workload · ${memberHours.length}` },
                { id: 'sessions', label: `Sessions · ${detailedRows.length}` },
              ] as { id: ReportTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative px-4 py-2.5 text-[13px] font-semibold transition-colors',
                  tab === t.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {tab === t.id && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary via-accent to-fuchsia-500"
                  />
                )}
              </button>
            ))}
          </div>

          {/* ───────── OVERVIEW ───────── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Two-column chart grid (pixel mosaic) */}
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 lg:grid-cols-2">
                {/* Hours by task */}
                <div className="flex flex-col gap-4 bg-card p-5">
                  <ChartHeader Icon={Clock} label="Hours by task" />
                  {taskHours.length === 0 ? (
                    <EmptyPane height={260} text="No time tracked yet" />
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(220, Math.min(taskHours.length, 8) * 36)}
                    >
                      <BarChart
                        data={taskHours.slice(0, 8)}
                        layout="vertical"
                        margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
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
                          tickFormatter={(v: number) =>
                            v > 0 ? formatDuration(v) : '0'
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fontWeight: 600 }}
                          width={120}
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
                          formatter={(v) => formatDuration(Number(v))}
                        />
                        <Bar
                          dataKey="hours"
                          radius={[0, 6, 6, 0]}
                          animationDuration={600}
                        >
                          {taskHours.slice(0, 8).map((t, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {taskHours.length > 8 && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Showing top 8 of {taskHours.length}
                    </p>
                  )}
                </div>

                {/* Status donut */}
                <div className="flex flex-col gap-4 bg-card p-5">
                  <ChartHeader Icon={PieIcon} label="Task status" />
                  {statusData.length === 0 ? (
                    <EmptyPane height={260} text="No tasks yet" />
                  ) : (
                    <div className="relative mx-auto w-full max-w-[260px]">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={88}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="transparent"
                            onMouseEnter={(_, i) => setActivePieIndex(i)}
                            onMouseLeave={() => setActivePieIndex(-1)}
                          >
                            {statusData.map((e, i) => (
                              <Cell
                                key={i}
                                fill={STATUS_COLORS[e.status] || '#94a3b8'}
                              />
                            ))}
                          </Pie>
                          {/* No floating tooltip — the centre label does the
                              hover story. Kept the chart's internal event
                              plumbing working via onMouseEnter/Leave on the
                              Pie itself. */}
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                          {activePieIndex >= 0 ? 'Selected' : 'Total'}
                        </span>
                        <span className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">
                          {activePieIndex >= 0
                            ? statusData[activePieIndex].value
                            : statusData.reduce((s, d) => s + d.value, 0)}
                        </span>
                        {activePieIndex >= 0 && (
                          <span className="mt-1 max-w-[120px] truncate px-2 text-[10px] text-muted-foreground/80">
                            {statusData[activePieIndex].name}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Legend below the donut — clean grid, clickable rows
                      that set the hovered slice state for consistency. */}
                  {statusData.length > 0 && (
                    <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {statusData.map((s, i) => {
                        const total = statusData.reduce(
                          (sum, d) => sum + d.value,
                          0,
                        )
                        const pct =
                          total > 0 ? Math.round((s.value / total) * 100) : 0
                        const active = activePieIndex === i
                        return (
                          <li
                            key={s.status}
                            onMouseEnter={() => setActivePieIndex(i)}
                            onMouseLeave={() => setActivePieIndex(-1)}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors',
                              active ? 'bg-muted/60' : 'hover:bg-muted/40',
                            )}
                          >
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full transition-transform',
                                active && 'scale-125',
                              )}
                              style={{
                                backgroundColor:
                                  STATUS_COLORS[s.status] || '#94a3b8',
                              }}
                            />
                            <span className="flex-1 truncate text-foreground/85">
                              {s.name}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {s.value} · {pct}%
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Estimated vs Actual — only when we have estimate data */}
              {estVsActual.length > 0 && (
                <div className="rounded-2xl border border-border/70 bg-card p-5">
                  <ChartHeader Icon={Target} label="Estimated vs actual" />
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(200, Math.min(estVsActual.length, 10) * 40)}
                  >
                    <BarChart
                      data={estVsActual.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
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
                        tickFormatter={(v: number) =>
                          v > 0 ? formatDuration(v) : '0'
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fontWeight: 600 }}
                        width={130}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 10,
                          border: '1px solid rgba(0,0,0,0.08)',
                        }}
                        formatter={(v) => formatDuration(Number(v))}
                      />
                      <Bar
                        dataKey="estimated"
                        name="Estimated"
                        fill="#c7d2fe"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={18}
                      />
                      <Bar
                        dataKey="tracked"
                        name="Tracked"
                        fill="#6366f1"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center justify-center gap-5 border-t border-border/50 pt-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-sm bg-[#c7d2fe]" />
                      <span className="font-semibold text-foreground">
                        Estimated
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-sm bg-[#6366f1]" />
                      <span className="font-semibold text-foreground">
                        Tracked
                      </span>
                    </span>
                  </div>
                  {estVsActual.length > 10 && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Showing 10 of {estVsActual.length} tasks — see Sessions
                      tab for a complete log.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ───────── WORKLOAD ───────── */}
          {tab === 'workload' && (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              {memberHours.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-muted-foreground">
                  No activity in this window.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {memberHours.map((m, i) => {
                    const pct =
                      totalHours > 0
                        ? Math.round((m.hours / totalHours) * 100)
                        : 0
                    const topTasks = Array.from(m.tasks.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                    return (
                      <li key={i} className="p-5">
                        {/* Top row: name + headline numbers */}
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="flex-1 truncate text-sm font-semibold text-foreground">
                            {m.name}
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                            {formatDuration(m.hours)}
                          </span>
                          <span className="w-12 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </div>

                        {/* Task-mix stacked bar */}
                        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                          {Array.from(m.tasks.entries())
                            .sort((a, b) => b[1] - a[1])
                            .map(([task, hrs]) => (
                              <div
                                key={task}
                                title={`${task}: ${formatDuration(hrs)}`}
                                style={{
                                  width: `${m.hours > 0 ? (hrs / m.hours) * 100 : 0}%`,
                                  backgroundColor:
                                    taskColorMap[task] || '#94a3b8',
                                }}
                              />
                            ))}
                        </div>

                        {/* Top tasks list — tight, no more chip legend */}
                        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                          {topTasks.map(([task, hrs]) => (
                            <span
                              key={task}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    taskColorMap[task] || '#94a3b8',
                                }}
                              />
                              <span className="truncate">{task}</span>
                              <span className="shrink-0 font-mono tabular-nums text-foreground/70">
                                {formatDuration(hrs)}
                              </span>
                            </span>
                          ))}
                          {m.tasks.size > 5 && (
                            <span className="text-[11px] text-muted-foreground/70">
                              +{m.tasks.size - 5} more
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ───────── SESSIONS ───────── */}
          {tab === 'sessions' && (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="grid grid-cols-[90px_1.3fr_1.3fr_80px_80px_80px] gap-2 border-b border-border/60 bg-muted/40 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <span>Date</span>
                <span>Member</span>
                <span>Task</span>
                <span>Start</span>
                <span>End</span>
                <span className="text-right">Duration</span>
              </div>
              {detailedRows.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-muted-foreground">
                  No sessions in this window.
                </div>
              ) : (
                <div className="max-h-[560px] divide-y divide-border/60 overflow-y-auto">
                  {detailedRows.map((r, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[90px_1.3fr_1.3fr_80px_80px_80px] items-center gap-2 px-5 py-2.5 text-[12px] transition-colors hover:bg-muted/30"
                    >
                      <span className="text-muted-foreground">
                        {formatDateShort(r.date)}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {r.member}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {r.task}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {formatTime(r.signIn)}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {r.signOut ? (
                          formatTime(r.signOut)
                        ) : (
                          <span className="font-sans font-semibold text-emerald-600">
                            Active
                          </span>
                        )}
                      </span>
                      <span className="text-right font-mono font-semibold tabular-nums text-foreground">
                        {r.hours != null ? formatDuration(r.hours) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function MetricTile({
  Icon,
  label,
  value,
  hint,
  tint,
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  tint: 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose'
}) {
  const tintClass = {
    indigo:
      'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
    violet:
      'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300',
    sky: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300',
    emerald:
      'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
    amber:
      'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300',
    rose: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300',
  }[tint]
  return (
    <div className="group flex items-center gap-3 bg-card p-5 transition-colors hover:bg-muted/30">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm transition-transform duration-300 group-hover:scale-110',
          tintClass,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate font-mono text-xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

function ChartHeader({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
        {label}
      </p>
    </div>
  )
}

function EmptyPane({ height, text }: { height: number; text: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border/70 text-[12px] text-muted-foreground"
      style={{ height }}
    >
      {text}
    </div>
  )
}
