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
  Legend,
} from 'recharts'

type Period = 'daily' | 'weekly' | 'monthly'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
]

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

  // Custom tooltip for stacked bar
  const CustomBarTooltip = ({ active, payload, label: tipLabel }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null
    const items = payload.filter((p) => p.value > 0)
    if (items.length === 0) return null
    const total = items.reduce((s, p) => s + p.value, 0)
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 mb-1.5">{tipLabel}</p>
        {items.map((p) => (
          <div key={p.name} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-gray-600 flex-1">{p.name}</span>
            <span className="font-medium text-gray-800 tabular-nums">{formatDuration(p.value)}</span>
          </div>
        ))}
        {items.length > 1 && (
          <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex justify-between">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="font-bold text-indigo-700 tabular-nums">{formatDuration(total)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-3 shadow-sm">
        <button onClick={() => setOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{start === end ? start : `${start} to ${end}`}</p>
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
          className={`p-2 rounded-xl transition-colors ${offset >= 0 ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <p className="text-sm text-gray-400">No time data for this period</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard label="Total Hours" value={formatDuration(totalHours)} icon={<ClockIcon />} color="indigo" />
            <SummaryCard label="Team Members" value={String(totalMembers)} icon={<UsersIcon />} color="violet" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stacked Bar Chart — Hours per day, split by project/task */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                {categoryKey === 'project' ? 'Hours by Project' : 'Hours by Task'} — {period === 'daily' ? 'Per Member' : 'Per Day'}
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stackedBarData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval={period === 'monthly' ? 2 : 0} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}h`} />
                  <Tooltip content={<CustomBarTooltip />} />
                  {allCategories.map((cat) => (
                    <Bar key={cat} dataKey={cat} stackId="hours" fill={colorMap[cat]} radius={[0, 0, 0, 0]} maxBarSize={40} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                {allCategories.map((cat) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[cat] }} />
                    <span className="text-xs text-gray-600">{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">{pieLabel}</h3>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-[320px]">
                  <p className="text-sm text-gray-300">No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={colorMap[entry.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const entry = payload[0]
                        const val = Number(entry.value)
                        const pct = totalHours > 0 ? Math.round((val / totalHours) * 100) : 0
                        return (
                          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload?.fill }} />
                              <span className="font-semibold text-gray-800">{entry.name}</span>
                            </div>
                            <p className="text-gray-600">{formatDuration(val)}</p>
                            <p className="text-indigo-600 font-bold">{pct}%</p>
                          </div>
                        )
                      }}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">Member Breakdown</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map((row, i) => {
          const isOpen = expanded.has(row.userId)
          const pct = totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0
          return (
            <div key={row.userId}>
              {/* Summary row */}
              <button
                onClick={() => toggle(row.userId)}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50 transition-colors text-left"
              >
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-800">{row.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-700 tabular-nums min-w-[80px] text-right">{formatDuration(row.hours)}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 tabular-nums w-10 text-right">{pct}%</span>
                </div>
              </button>

              {/* Expanded session details */}
              {isOpen && (
                <div className="bg-gray-50/70 px-6 pb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                        <th className="text-left py-2 pr-3">Date</th>
                        <th className="text-left py-2 pr-3">Project</th>
                        <th className="text-left py-2 pr-3">Task</th>
                        <th className="text-left py-2 pr-3">Start</th>
                        <th className="text-left py-2 pr-3">End</th>
                        <th className="text-right py-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {row.sessions
                        .sort((a, b) => new Date(a.signInAt).getTime() - new Date(b.signInAt).getTime())
                        .map((s, j) => (
                        <tr key={j} className="hover:bg-white/60 transition-colors">
                          <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{formatDate(s.date)}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                              <span className="text-gray-700 font-medium">{s.projectName}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{s.taskTitle}</td>
                          <td className="py-2 pr-3 text-gray-500 font-mono tabular-nums">{formatTime(s.signInAt)}</td>
                          <td className="py-2 pr-3 text-gray-500 font-mono tabular-nums">{s.signOutAt ? formatTime(s.signOutAt) : <span className="text-emerald-600 font-medium">Active</span>}</td>
                          <td className="py-2 text-right font-semibold text-gray-700 tabular-nums">{s.hours != null ? formatDuration(s.hours) : '—'}</td>
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
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-xl ${gradients[color]} flex items-center justify-center shadow-sm text-white`}>
          {icon}
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
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
