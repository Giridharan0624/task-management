'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { useUsers } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { Attendance } from '@/types/attendance'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { ActivityReport } from '@/components/reports/ActivityReport'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

type ReportView = 'summary' | 'detailed' | 'weekly' | 'activity'
type Period = 'daily' | 'weekly' | 'monthly'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
]

function pad(n: number) { return String(n).padStart(2, '0') }

function getDateRange(period: Period, offset: number) {
  const now = new Date()
  if (period === 'daily') {
    const d = new Date(now); d.setDate(d.getDate() + offset)
    const iso = d.toISOString().slice(0, 10)
    return { start: iso, end: iso, label: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) }
  }
  if (period === 'weekly') {
    const d = new Date(now)
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
    const mon = new Date(d), sun = new Date(d); sun.setDate(sun.getDate() + 6)
    return {
      start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10),
      label: `${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    }
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: d.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
}

function getWeekDates(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const d = new Date(now)
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d); dd.setDate(dd.getDate() + i)
    dates.push(dd.toISOString().slice(0, 10))
  }
  const mon = new Date(d), sun = new Date(d); sun.setDate(sun.getDate() + 6)
  return {
    dates,
    start: dates[0], end: dates[6],
    label: `${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

function getDatesBetween(start: string, end: string) {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00'), last = new Date(end + 'T00:00:00')
  while (d <= last) { dates.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return dates
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDayLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}

export default function ReportsPage() {
  const { user } = useAuth()
  const { data: allUsers } = useUsers()
  const [view, setView] = useState<ReportView>('summary')
  const [period, setPeriod] = useState<Period>('weekly')
  const [offset, setOffset] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)
  const [memberFilter, setMemberFilter] = useState<string>('ALL')

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  // Summary/Detailed data
  const { start, end, label } = useMemo(() => getDateRange(period, offset), [period, offset])
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)

  // Weekly data
  const weekData = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const { data: weekRecords, isLoading: weekLoading } = useAttendanceReport(weekData.start, weekData.end)

  // Filter by member
  const records = useMemo(() => {
    if (!rawRecords) return []
    if (memberFilter === 'ALL') return rawRecords
    return rawRecords.filter(r => r.userId === memberFilter)
  }, [rawRecords, memberFilter])

  const filteredWeekRecords = useMemo(() => {
    if (!weekRecords) return []
    if (memberFilter === 'ALL') return weekRecords
    return weekRecords.filter(r => r.userId === memberFilter)
  }, [weekRecords, memberFilter])

  // Unique members from data
  const memberOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rawRecords ?? []) map.set(r.userId, r.userName || r.userEmail)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawRecords])

  // ──── Summary data ────
  const projectHoursMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) for (const s of r.sessions) {
      const p = s.projectName || 'No Project'
      map.set(p, (map.get(p) ?? 0) + (s.hours ?? 0))
    }
    return map
  }, [records])

  const allProjects = useMemo(() => Array.from(projectHoursMap.keys()).sort(), [projectHoursMap])
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {}
    allProjects.forEach((p, i) => { m[p] = COLORS[i % COLORS.length] })
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
        for (const p of allProjects) entry[p] = Math.round((cats[p] ?? 0) * 100) / 100
        return entry
      })
    }
    const dates = getDatesBetween(start, end)
    const dateMap = new Map<string, Record<string, number>>()
    for (const d of dates) dateMap.set(d, {})
    for (const r of records) {
      const de = dateMap.get(r.date); if (!de) continue
      for (const s of r.sessions) { const p = s.projectName || 'No Project'; de[p] = (de[p] ?? 0) + (s.hours ?? 0) }
    }
    return dates.map(d => {
      const entry: Record<string, string | number> = { date: formatDayLabel(d) }
      for (const p of allProjects) entry[p] = Math.round((dateMap.get(d)![p] ?? 0) * 100) / 100
      return entry
    })
  }, [records, start, end, period, allProjects])

  const pieData = useMemo(() =>
    Array.from(projectHoursMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value),
    [projectHoursMap])

  const totalHours = useMemo(() => records.reduce((s, r) => s + (r.sessions?.reduce((ss, se) => ss + (se.hours ?? 0), 0) ?? 0), 0), [records])
  const totalMembers = useMemo(() => new Set(records.map(r => r.userId)).size, [records])
  const totalSessions = useMemo(() => records.reduce((s, r) => s + (r.sessions?.length ?? 0), 0), [records])

  // Top tasks
  const topTasks = useMemo(() => {
    const map = new Map<string, { name: string; project: string; hours: number }>()
    for (const r of records) for (const s of r.sessions) {
      const key = `${s.taskTitle || 'General'}::${s.projectName || ''}`
      const ex = map.get(key)
      if (ex) ex.hours += s.hours ?? 0
      else map.set(key, { name: s.taskTitle || 'General', project: s.projectName || 'No Project', hours: s.hours ?? 0 })
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours).slice(0, 5)
  }, [records])

  // ──── Detailed data ────
  const detailedRows = useMemo(() => {
    const rows: { date: string; member: string; project: string; task: string; description: string; signIn: string; signOut: string | null; hours: number | null }[] = []
    for (const r of records) for (const s of r.sessions) {
      rows.push({ date: r.date, member: r.userName || r.userEmail, project: s.projectName || 'No Project', task: s.taskTitle || 'General', description: s.description || '', signIn: s.signInAt, signOut: s.signOutAt, hours: s.hours })
    }
    return rows.sort((a, b) => new Date(b.signIn).getTime() - new Date(a.signIn).getTime())
  }, [records])

  // ──── Weekly grid data ────
  const weeklyGrid = useMemo(() => {
    const memberMap = new Map<string, { name: string; days: Record<string, number> }>()
    for (const r of filteredWeekRecords) {
      if (!memberMap.has(r.userId)) memberMap.set(r.userId, { name: r.userName || r.userEmail, days: {} })
      const entry = memberMap.get(r.userId)!
      const hrs = r.sessions.reduce((s, se) => s + (se.hours ?? 0), 0)
      entry.days[r.date] = (entry.days[r.date] ?? 0) + hrs
    }
    return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredWeekRecords])

  const weekTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const d of weekData.dates) totals[d] = 0
    for (const m of weeklyGrid) for (const [d, h] of Object.entries(m.days)) totals[d] = (totals[d] ?? 0) + h
    return totals
  }, [weeklyGrid, weekData.dates])

  // CSV export
  const exportCSV = () => {
    const header = ['Date', 'Member', 'Project', 'Task', 'Start', 'End', 'Duration']
    const rows = detailedRows.map(r => [
      r.date, r.member, r.project, r.task,
      formatTime(r.signIn), r.signOut ? formatTime(r.signOut) : 'Active',
      r.hours != null ? formatDuration(r.hours) : '—',
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `time-report-${start}-${end}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!isPrivileged) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">You don&apos;t have permission to view reports.</p></div>
  }

  const CustomBarTooltip = ({ active, payload, label: tipLabel }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null
    const items = payload.filter(p => p.value > 0)
    if (!items.length) return null
    const total = items.reduce((s, p) => s + p.value, 0)
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 mb-1.5">{tipLabel}</p>
        {items.map(p => (
          <div key={p.name} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
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
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track hours, analyze productivity, and export data</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Member filter */}
          <FilterSelect value={memberFilter} onChange={setMemberFilter} active={memberFilter !== 'ALL'}
            options={[{ value: 'ALL', label: 'All Members' }, ...memberOptions.map(m => ({ value: m.id, label: m.name }))]} />
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['summary', 'Summary'], ['detailed', 'Detailed'], ['weekly', 'Weekly'], ['activity', 'Activity']] as [ReportView, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════════════ SUMMARY VIEW ════════════════ */}
      {view === 'summary' && (
        <div className="space-y-5">
          {/* Period + nav */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setOffset(0) }}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${period === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[13px] font-semibold text-gray-700 min-w-[180px] text-center">{label}</span>
              <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
                className={`p-1.5 rounded-lg ${offset >= 0 ? 'text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-gray-100">
              <p className="text-sm text-gray-400">No time data for this period</p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Hours" value={formatDuration(totalHours)} color="indigo"
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <StatCard label="Members" value={String(totalMembers)} color="violet"
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
                <StatCard label="Sessions" value={String(totalSessions)} color="blue"
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
                <StatCard label="Projects" value={String(allProjects.length)} color="emerald"
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-[13px] font-bold text-gray-700 mb-4">Hours by Project — {period === 'daily' ? 'Per Member' : 'Per Day'}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stackedBarData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval={period === 'monthly' ? 2 : 0} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => v > 0 ? formatDuration(v) : '0'} />
                      <Tooltip content={<CustomBarTooltip />} />
                      {allProjects.map(p => <Bar key={p} dataKey={p} stackId="h" fill={colorMap[p]} maxBarSize={40} />)}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                    {allProjects.map(p => (
                      <div key={p} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap[p] }} />
                        <span className="text-[11px] text-gray-500">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-[13px] font-bold text-gray-700 mb-4">Distribution</h3>
                  {pieData.length === 0 ? <div className="flex items-center justify-center h-[300px]"><p className="text-sm text-gray-300">No data</p></div> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                          {pieData.map(e => <Cell key={e.name} fill={colorMap[e.name] || COLORS[0]} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const e = payload[0]; const v = Number(e.value); const pct = totalHours > 0 ? Math.round((v / totalHours) * 100) : 0
                          return <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
                            <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.payload?.fill }} /><span className="font-semibold text-gray-800">{e.name}</span></div>
                            <p className="text-gray-600">{formatDuration(v)}</p><p className="text-indigo-600 font-bold">{pct}%</p>
                          </div>
                        }} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Top Tasks */}
              {topTasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-gray-800">Top Tasks by Time</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {topTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="text-[11px] font-bold text-gray-300 w-5 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-800 truncate">{t.name}</p>
                          <p className="text-[10px] text-gray-400">{t.project}</p>
                        </div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${totalHours > 0 ? (t.hours / totalHours) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold text-gray-700 tabular-nums w-16 text-right">{formatDuration(t.hours)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Member Breakdown */}
              <MemberBreakdown records={records} totalHours={totalHours} />
            </>
          )}
        </div>
      )}

      {/* ════════════════ DETAILED VIEW ════════════════ */}
      {view === 'detailed' && (
        <div className="space-y-5">
          {/* Period + nav */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setOffset(0) }}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${period === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[13px] font-semibold text-gray-700 min-w-[180px] text-center">{label}</span>
              <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
                className={`p-1.5 rounded-lg ${offset >= 0 ? 'text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (() => {
            // Group by member
            const memberGroups = new Map<string, { member: string; totalHours: number; sessions: typeof detailedRows }>()
            for (const r of detailedRows) {
              const ex = memberGroups.get(r.member)
              if (ex) { ex.totalHours += (r.hours ?? 0); ex.sessions.push(r) }
              else memberGroups.set(r.member, { member: r.member, totalHours: r.hours ?? 0, sessions: [r] })
            }
            const groups = Array.from(memberGroups.values()).sort((a, b) => b.totalHours - a.totalHours)

            return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-[13px] font-bold text-gray-800">Time Log</h3>
                  <span className="text-[11px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-md tabular-nums">{detailedRows.length} entries</span>
                  <span className="text-[11px] text-gray-400">Total: <strong className="text-gray-700">{formatDuration(totalHours)}</strong></span>
                </div>
                <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Export CSV
                </button>
              </div>

              {groups.length === 0 ? (
                <div className="px-5 py-12 text-center text-[13px] text-gray-300">No sessions in this period</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groups.map(g => (
                    <DetailedMemberGroup key={g.member} group={g} />
                  ))}
                </div>
              )}
            </div>
            )
          })()}
        </div>
      )}

      {/* ════════════════ WEEKLY VIEW ════════════════ */}
      {view === 'weekly' && (
        <div className="space-y-5">
          {/* Week navigator */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-[13px] font-semibold text-gray-700 min-w-[220px] text-center">{weekData.label}</span>
            <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}
              className={`p-1.5 rounded-lg ${weekOffset >= 0 ? 'text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {weekLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-40">Member</th>
                    {weekData.dates.map(d => {
                      const isToday = d === (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
                      return <th key={d} className={`text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400'}`}>
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}<br/>
                        <span className="text-[9px] font-semibold">{new Date(d + 'T00:00:00').getDate()}</span>
                      </th>
                    })}
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-700 uppercase tracking-wider bg-gray-50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {weeklyGrid.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-12 text-center text-[13px] text-gray-300">No data this week</td></tr>
                  ) : weeklyGrid.map(m => {
                    const memberTotal = Object.values(m.days).reduce((s, h) => s + h, 0)
                    return (
                      <tr key={m.name} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{m.name}</td>
                        {weekData.dates.map(d => {
                          const hrs = m.days[d] ?? 0
                          const isToday = d === (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
                          return <td key={d} className={`text-center px-3 py-3 tabular-nums ${isToday ? 'bg-indigo-50/30' : ''} ${hrs > 0 ? 'text-gray-700 font-medium' : 'text-gray-200'}`}>
                            {hrs > 0 ? formatDuration(hrs) : '—'}
                          </td>
                        })}
                        <td className="text-center px-4 py-3 font-bold text-indigo-700 tabular-nums bg-gray-50/50">{formatDuration(memberTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {weeklyGrid.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50/70">
                      <td className="px-5 py-3 font-bold text-gray-700">Total</td>
                      {weekData.dates.map(d => {
                        const t = weekTotals[d] ?? 0
                        return <td key={d} className="text-center px-3 py-3 font-bold text-gray-700 tabular-nums">{t > 0 ? formatDuration(t) : '—'}</td>
                      })}
                      <td className="text-center px-4 py-3 font-black text-indigo-700 tabular-nums bg-gray-100/50">
                        {formatDuration(Object.values(weekTotals).reduce((s, h) => s + h, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'activity' && (
        <ActivityReport />
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

function DetailedMemberGroup({ group }: { group: { member: string; totalHours: number; sessions: { date: string; project: string; task: string; description: string; signIn: string; signOut: string | null; hours: number | null }[] } }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors text-left">
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[13px] font-semibold text-gray-800 flex-1">{group.member}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
        <span className="text-[13px] font-bold text-indigo-600 tabular-nums min-w-[80px] text-right">{formatDuration(group.totalHours)}</span>
      </button>
      {open && (
        <div className="bg-gray-50/70 px-5 pb-3">
          <div className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px] gap-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Date</span><span>Project</span><span>Task</span><span>Start</span><span>End</span><span className="text-right">Duration</span>
          </div>
          <div className="divide-y divide-gray-100">
            {group.sessions.map((s, i) => (
              <div key={i} className="py-2 text-[11px]">
                <div className="grid grid-cols-[80px_1fr_1fr_80px_80px_70px] gap-2">
                  <span className="text-gray-500">{formatDateShort(s.date)}</span>
                  <span className="text-gray-600 truncate">{s.project}</span>
                  <span className="text-gray-700 font-medium truncate">{s.task}</span>
                  <span className="text-gray-500 font-mono tabular-nums">{formatTime(s.signIn)}</span>
                  <span className="text-gray-500 font-mono tabular-nums">{s.signOut ? formatTime(s.signOut) : <span className="text-emerald-600 font-sans font-medium">Active</span>}</span>
                  <span className="text-right font-semibold text-gray-700 tabular-nums">{s.hours != null ? formatDuration(s.hours) : '—'}</span>
                </div>
                {s.description && <p className="text-[10px] text-gray-400 italic mt-0.5">— {s.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  const gradients: Record<string, string> = {
    indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    violet: 'bg-gradient-to-br from-violet-500 to-violet-600',
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  }
  const textColors: Record<string, string> = { indigo: 'text-indigo-700', violet: 'text-violet-700', blue: 'text-blue-700', emerald: 'text-emerald-700' }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`h-7 w-7 rounded-lg ${gradients[color]} flex items-center justify-center shadow-sm text-white`}>
          {icon}
        </div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-bold ${textColors[color]} tracking-tight tabular-nums`}>{value}</p>
    </div>
  )
}

function MemberBreakdown({ records, totalHours }: { records: Attendance[]; totalHours: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rows = useMemo(() => {
    const map = new Map<string, { userId: string; name: string; hours: number; sessions: { date: string; signInAt: string; signOutAt: string | null; hours: number | null; taskTitle: string; projectName: string; description: string }[] }>()
    for (const r of records) {
      const sessions = r.sessions.map(s => ({ date: r.date, signInAt: s.signInAt, signOutAt: s.signOutAt, hours: s.hours, taskTitle: s.taskTitle || 'General', projectName: s.projectName || 'No Project', description: s.description || '' }))
      const ex = map.get(r.userId)
      if (ex) { ex.hours += sessions.reduce((s, se) => s + (se.hours ?? 0), 0); ex.sessions.push(...sessions) }
      else map.set(r.userId, { userId: r.userId, name: r.userName || r.userEmail || r.userId, hours: sessions.reduce((s, se) => s + (se.hours ?? 0), 0), sessions })
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50"><h3 className="text-[13px] font-bold text-gray-800">Member Breakdown</h3></div>
      <div className="divide-y divide-gray-50">
        {rows.map((row, i) => {
          const isOpen = expanded.has(row.userId)
          const pct = totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0
          return (
            <div key={row.userId}>
              <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(row.userId) ? n.delete(row.userId) : n.add(row.userId); return n })}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors text-left">
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[13px] font-medium text-gray-800">{row.name}</span>
                </div>
                <span className="text-[12px] font-semibold text-gray-700 tabular-nums min-w-[70px] text-right">{formatDuration(row.hours)}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
                </div>
              </button>
              {isOpen && (
                <div className="bg-gray-50/70 px-5 pb-3">
                  <div className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Date</span><span>Project</span><span>Task</span><span>Start</span><span>End</span><span className="text-right">Duration</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {row.sessions.sort((a, b) => new Date(a.signInAt).getTime() - new Date(b.signInAt).getTime()).map((s, j) => (
                      <div key={j} className="py-2 text-[11px] hover:bg-white/60 transition-colors">
                        <div className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2">
                          <span className="text-gray-500">{formatDateShort(s.date)}</span>
                          <span className="text-gray-700 font-medium truncate">{s.projectName}</span>
                          <span className="text-gray-600 truncate">{s.taskTitle}</span>
                          <span className="text-gray-500 font-mono tabular-nums">{formatTime(s.signInAt)}</span>
                          <span className="text-gray-500 font-mono tabular-nums">{s.signOutAt ? formatTime(s.signOutAt) : <span className="text-emerald-600 font-sans font-medium">Active</span>}</span>
                          <span className="text-right font-semibold text-gray-700 tabular-nums">{s.hours != null ? formatDuration(s.hours) : '—'}</span>
                        </div>
                        {s.description && <p className="text-[10px] text-gray-400 italic mt-0.5 ml-[90px]">— {s.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
