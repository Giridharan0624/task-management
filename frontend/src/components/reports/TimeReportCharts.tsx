'use client'

import { useState, useMemo } from 'react'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { Attendance } from '@/types/attendance'
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

type Period = 'daily' | 'weekly' | 'monthly'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
]

/** Recharts v3 removed activeIndex/activeShape from Pie's public types but still supports them at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pieInteractiveProps(activeIndex: number): any {
  return {
    activeIndex,
    activeShape: (props: {
      cx: number; cy: number; innerRadius: number; outerRadius: number
      startAngle: number; endAngle: number; fill: string
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

function getDateRange(period: Period, offset: number): { start: string; end: string; label: string } {
  const now = new Date()

  if (period === 'daily') {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    const iso = d.toISOString().slice(0, 10)
    return { start: iso, end: iso, label: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) }
  }

  if (period === 'weekly') {
    const d = new Date(now)
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + mondayOffset + offset * 7)
    const monday = new Date(d)
    const sunday = new Date(d)
    sunday.setDate(sunday.getDate() + 6)
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
      label: `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    }
  }

  // monthly
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: d.toISOString().slice(0, 10),
    end: lastDay.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  }
}

/** Generate all date strings between start and end (inclusive) */
function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function formatDateLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'daily') return d.toLocaleDateString('en-IN', { hour: 'numeric' })
  if (period === 'weekly') return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
  // monthly — show day number
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface TimeReportChartsProps {
  projectId?: string
  title?: string
  subtitle?: string
  pieLabel?: string
}

export function TimeReportCharts({
  projectId,
  title = 'Time Reports',
  subtitle = 'Hours worked by team members',
  pieLabel = 'Hours by Project',
}: TimeReportChartsProps) {
  const [period, setPeriod] = useState<Period>('weekly')
  const [offset, setOffset] = useState(0)
  const [activePieIndex, setActivePieIndex] = useState<number>(-1)

  const { start, end, label } = useMemo(() => getDateRange(period, offset), [period, offset])
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)

  // Filter records/sessions by project if projectId is specified
  const records: Attendance[] = useMemo(() => {
    if (!rawRecords) return []
    if (!projectId) return rawRecords
    return rawRecords
      .map((r) => {
        const filteredSessions = r.sessions.filter((s) => s.projectId === projectId)
        if (filteredSessions.length === 0) return null
        const totalHours = filteredSessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
        return { ...r, sessions: filteredSessions, totalHours }
      })
      .filter(Boolean) as Attendance[]
  }, [rawRecords, projectId])

  // Collect all unique category names (projects or tasks)
  const categoryKey = projectId ? 'task' : 'project'
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) {
      for (const s of r.sessions) {
        const name = categoryKey === 'project'
          ? (s.projectName || 'No Project')
          : (s.taskTitle || 'General')
        set.add(name)
      }
    }
    return Array.from(set).sort()
  }, [records, categoryKey])

  // Build color map for categories
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {}
    allCategories.forEach((name, i) => { map[name] = COLORS[i % COLORS.length] })
    return map
  }, [allCategories])

  // Stacked bar data
  // Daily: one bar per member, stacked by project/task
  // Weekly/Monthly: one bar per day, stacked by project/task
  const stackedBarData = useMemo(() => {
    if (period === 'daily') {
      // Group by member, stack by category
      const memberMap = new Map<string, Record<string, number>>()
      for (const r of records) {
        const memberName = (r.userName || r.userEmail || r.userId).split(' ')[0]
        if (!memberMap.has(memberName)) memberMap.set(memberName, {})
        const entry = memberMap.get(memberName)!
        for (const s of r.sessions) {
          const name = categoryKey === 'project'
            ? (s.projectName || 'No Project')
            : (s.taskTitle || 'General')
          entry[name] = (entry[name] ?? 0) + (s.hours ?? 0)
        }
      }
      return Array.from(memberMap.entries()).map(([member, cats]) => {
        const entry: Record<string, string | number> = { date: member }
        for (const cat of allCategories) {
          entry[cat] = Math.round((cats[cat] ?? 0) * 100) / 100
        }
        return entry
      })
    }

    // Weekly/Monthly: group by day
    const dates = getDatesBetween(start, end)
    const dateMap = new Map<string, Record<string, number>>()
    for (const d of dates) dateMap.set(d, {})

    for (const r of records) {
      const dateEntry = dateMap.get(r.date)
      if (!dateEntry) continue
      for (const s of r.sessions) {
        const name = categoryKey === 'project'
          ? (s.projectName || 'No Project')
          : (s.taskTitle || 'General')
        dateEntry[name] = (dateEntry[name] ?? 0) + (s.hours ?? 0)
      }
    }

    return dates.map((d) => {
      const entry: Record<string, string | number> = { date: formatDateLabel(d, period) }
      const dayData = dateMap.get(d)!
      for (const cat of allCategories) {
        entry[cat] = Math.round((dayData[cat] ?? 0) * 100) / 100
      }
      return entry
    })
  }, [records, start, end, period, allCategories, categoryKey])

  // Pie chart data
  const pieData = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) {
      for (const s of r.sessions) {
        const name = categoryKey === 'project'
          ? (s.projectName || 'No Project')
          : (s.taskTitle || 'General')
        map.set(name, (map.get(name) ?? 0) + (s.hours ?? 0))
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [records, categoryKey])

  // Summary
  const totalHours = useMemo(() => {
    let sum = 0
    for (const r of records) {
      for (const s of r.sessions) sum += s.hours ?? 0
    }
    return sum
  }, [records])

  const totalMembers = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) set.add(r.userId)
    return set.size
  }, [records])

  const hasData = records.length > 0

  // Custom tooltip for the stacked bar chart.
  //
  // Design notes:
  // - Compact glass card (w-64) so it doesn't blanket the chart behind it.
  // - Items sorted by value descending — biggest contributors first.
  // - Only the top 6 show; a trailing "+N more (Xh)" line rolls up the rest
  //   so a 15-project day still produces a reasonably-sized tooltip.
  // - Left colour-stripe on each row (not a dot) — easier to match against
  //   the colour-coded segments of the stacked bar.
  // - Header shows the day label AND the stacked total on one line to save
  //   vertical space; that also means when only one project is shown there
  //   is no awkward duplicate-total row.
  const CustomBarTooltip = ({
    active,
    payload,
    label: tipLabel,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    const items = payload
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
    if (items.length === 0) return null

    const total = items.reduce((s, p) => s + p.value, 0)
    const MAX_ROWS = 6
    const visible = items.slice(0, MAX_ROWS)
    const hidden = items.slice(MAX_ROWS)
    const hiddenTotal = hidden.reduce((s, p) => s + p.value, 0)

    return (
      <div className="w-64 rounded-xl border border-white/60 bg-white/85 p-3 text-[12px] shadow-[0_20px_40px_-16px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/85">
        {/* Header: date + total on the same row when there's a total worth
            showing; otherwise just the date. */}
        <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {tipLabel}
          </span>
          {items.length > 1 && (
            <span className="font-mono text-sm font-bold tabular-nums text-primary">
              {formatDuration(total)}
            </span>
          )}
        </div>

        {/* Rows: coloured left-stripe + name + value */}
        <ul className="space-y-1">
          {visible.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-2 rounded-md py-0.5"
            >
              <span
                aria-hidden
                className="h-3 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground/85">
                {p.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {formatDuration(p.value)}
              </span>
            </li>
          ))}
        </ul>

        {hidden.length > 0 && (
          <p className="mt-2 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
            +{hidden.length} more ·{' '}
            <span className="font-mono tabular-nums">
              {formatDuration(hiddenTotal)}
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-card text-indigo-700 shadow-sm' : 'text-muted-foreground hover:text-foreground/85'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-5 py-3 shadow-sm">
        <button onClick={() => setOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground/85 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{start === end ? start : `${start} to ${end}`}</p>
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
          className={`p-2 rounded-xl transition-colors ${offset >= 0 ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-muted text-muted-foreground hover:text-foreground/85'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center h-64 bg-card rounded-2xl border border-border">
          <svg className="w-12 h-12 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <p className="text-sm text-muted-foreground/70">No time data for this period</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-up">
            <SummaryCard label="Total Hours" value={formatDuration(totalHours)} icon={<ClockIcon />} color="indigo" />
            <SummaryCard label="Team Members" value={String(totalMembers)} icon={<UsersIcon />} color="violet" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stacked Bar Chart — Hours per day, split by project/task */}
            <div className="relative bg-card rounded-2xl border border-border p-6 shadow-sm overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" aria-hidden />
              <div className="flex items-start justify-between mb-5 gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground/90 tracking-tight">
                    {categoryKey === 'project' ? 'Hours by project' : 'Hours by task'}
                    <span className="text-muted-foreground font-normal"> — {period === 'daily' ? 'per member' : 'per day'}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Across {allCategories.length} {allCategories.length === 1 ? categoryKey : categoryKey + 's'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Total</p>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{formatDuration(totalHours)}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stackedBarData} margin={{ left: -8, right: 8, top: 8, bottom: 0 }} barCategoryGap="22%">
                  <defs>
                    {allCategories.map((cat) => (
                      <linearGradient key={cat} id={`bargrad-${cat.replace(/[^a-zA-Z0-9]/g, '_')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colorMap[cat]} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={colorMap[cat]} stopOpacity={0.55} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} interval={period === 'monthly' ? 2 : 0} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} tickFormatter={(v: number) => formatDuration(v)} axisLine={false} tickLine={false} width={58} />
                  <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} content={<CustomBarTooltip />} />
                  {allCategories.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="hours"
                      fill={`url(#bargrad-${cat.replace(/[^a-zA-Z0-9]/g, '_')})`}
                      radius={i === allCategories.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={44}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {/* Legend with percentages */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 pt-4 border-t border-border/60">
                {allCategories.map((cat) => {
                  const catTotal = pieData.find((p) => p.name === cat)?.value ?? 0
                  const pct = totalHours > 0 ? Math.round((catTotal / totalHours) * 100) : 0
                  return (
                    <div key={cat} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[cat] }} />
                      <span className="text-xs text-foreground/85 font-medium">{cat}</span>
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums font-semibold">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="relative bg-card rounded-2xl border border-border p-6 shadow-sm overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" aria-hidden />
              <div className="flex items-start justify-between mb-5 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground/90 tracking-tight">Distribution</h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{pieLabel}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Entries</p>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{pieData.length}</p>
                </div>
              </div>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-[280px]">
                  <p className="text-sm text-muted-foreground/50">No data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center">
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
                          {...(pieInteractiveProps(activePieIndex))}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={colorMap[entry.name] || COLORS[0]} />
                          ))}
                        </Pie>
                        {/* No <Tooltip> — the donut's centre label and the
                            highlighted legend row on the right already
                            communicate the hovered slice. A floating
                            tooltip on top of the centre label produced a
                            visible overlap (duplicate values rendered on
                            top of each other). */}
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label — shows totals at rest, hovered-slice
                        details on hover. Replaces the recharts Tooltip
                        (which collided with this card). */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/70">
                        {activePieIndex >= 0 ? 'Selected' : 'Total'}
                      </span>
                      <span className="mt-1 text-base font-bold tabular-nums leading-tight text-foreground">
                        {activePieIndex >= 0
                          ? formatDuration(pieData[activePieIndex].value)
                          : formatDuration(totalHours)}
                      </span>
                      {activePieIndex >= 0 && (
                        <>
                          <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-primary">
                            {totalHours > 0
                              ? Math.round(
                                  (pieData[activePieIndex].value / totalHours) *
                                    100,
                                )
                              : 0}
                            %
                          </span>
                          <span className="mt-1 max-w-[110px] truncate px-2 text-[10px] text-muted-foreground/80">
                            {pieData[activePieIndex].name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Custom legend */}
                  <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {pieData.map((entry, i) => {
                      const pct = totalHours > 0 ? Math.round((entry.value / totalHours) * 100) : 0
                      const isActive = activePieIndex === i
                      return (
                        <div
                          key={entry.name}
                          onMouseEnter={() => setActivePieIndex(i)}
                          onMouseLeave={() => setActivePieIndex(-1)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-default ${isActive ? 'bg-muted/70' : 'hover:bg-muted/40'}`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform ${isActive ? 'scale-125' : ''}`}
                            style={{ backgroundColor: colorMap[entry.name] || COLORS[0] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground/90 truncate">{entry.name}</p>
                            <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">{formatDuration(entry.value)}</p>
                          </div>
                          <span className="text-xs font-bold text-foreground/85 tabular-nums">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Table — hours per member with session details */}
          <MemberBreakdown records={records} totalHours={totalHours} />
        </>
      )}
    </div>
  )
}

/* ─── Member Breakdown with expandable session details ─── */

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface MemberRow {
  userId: string
  name: string
  hours: number
  sessions: { date: string; signInAt: string; signOutAt: string | null; hours: number | null; taskTitle: string; projectName: string }[]
}

function MemberBreakdown({ records, totalHours }: { records: Attendance[]; totalHours: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rows: MemberRow[] = useMemo(() => {
    const map = new Map<string, MemberRow>()
    for (const r of records) {
      const existing = map.get(r.userId)
      const sessions = r.sessions.map((s) => ({
        date: r.date,
        signInAt: s.signInAt,
        signOutAt: s.signOutAt,
        hours: s.hours,
        taskTitle: s.taskTitle || 'General',
        projectName: s.projectName || 'No Project',
      }))
      if (existing) {
        existing.hours += sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
        existing.sessions.push(...sessions)
      } else {
        map.set(r.userId, {
          userId: r.userId,
          name: r.userName || r.userEmail || r.userId,
          hours: sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0),
          sessions,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  const toggle = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-bold text-foreground/85">Member Breakdown</h3>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row, i) => {
          const isOpen = expanded.has(row.userId)
          const pct = totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0
          return (
            <div key={row.userId}>
              {/* Summary row */}
              <button
                onClick={() => toggle(row.userId)}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-muted/30 transition-colors text-left"
              >
                <svg className={`w-4 h-4 text-muted-foreground/70 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-foreground/95">{row.name}</span>
                </div>
                <span className="text-sm font-semibold text-foreground/85 tabular-nums min-w-[80px] text-right">{formatDuration(row.hours)}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums w-10 text-right">{pct}%</span>
                </div>
              </button>

              {/* Expanded session details */}
              {isOpen && (
                <div className="bg-muted/40 px-6 pb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                        <th className="text-left py-2 pr-3">Date</th>
                        <th className="text-left py-2 pr-3">Project</th>
                        <th className="text-left py-2 pr-3">Task</th>
                        <th className="text-left py-2 pr-3">Start</th>
                        <th className="text-left py-2 pr-3">End</th>
                        <th className="text-right py-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {row.sessions
                        .sort((a, b) => new Date(a.signInAt).getTime() - new Date(b.signInAt).getTime())
                        .map((s, j) => (
                        <tr key={j} className="hover:bg-card/60 transition-colors">
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{formatDate(s.date)}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                              <span className="text-foreground/85 font-medium">{s.projectName}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{s.taskTitle}</td>
                          <td className="py-2 pr-3 text-muted-foreground font-mono tabular-nums">{formatTime(s.signInAt)}</td>
                          <td className="py-2 pr-3 text-muted-foreground font-mono tabular-nums">{s.signOutAt ? formatTime(s.signOutAt) : <span className="text-emerald-600 font-medium">Active</span>}</td>
                          <td className="py-2 text-right font-semibold text-foreground/85 tabular-nums">{s.hours != null ? formatDuration(s.hours) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Small Components ─── */

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const gradients: Record<string, string> = {
    indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    violet: 'bg-gradient-to-br from-violet-500 to-violet-600',
  }
  const textColors: Record<string, string> = {
    indigo: 'text-indigo-700',
    violet: 'text-violet-700',
  }
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-xl ${gradients[color]} flex items-center justify-center shadow-sm text-white`}>
          {icon}
        </div>
        <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${textColors[color]} tracking-tight`}>{value}</p>
    </div>
  )
}

function ClockIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

function UsersIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
