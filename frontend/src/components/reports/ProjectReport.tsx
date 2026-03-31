'use client'

import { useState, useMemo } from 'react'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { useProjectStatus } from '@/lib/hooks/useProjects'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'
import { TASK_STATUS_LABEL } from '@/types/task'
import type { Attendance } from '@/types/attendance'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

type Period = 'weekly' | 'monthly' | 'all'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
]

const STATUS_COLORS: Record<string, string> = {
  TODO: '#f59e0b', IN_PROGRESS: '#3b82f6', DEVELOPED: '#8b5cf6', TESTING: '#f97316',
  TESTED: '#14b8a6', DEBUGGING: '#ef4444', FINAL_TESTING: '#ec4899', DONE: '#10b981',
}

function pad(n: number) { return String(n).padStart(2, '0') }

function getRange(period: Period, offset: number) {
  const now = new Date()
  if (period === 'all') return { start: '2020-01-01', end: now.toISOString().slice(0, 10), label: 'All Time' }
  if (period === 'weekly') {
    const d = new Date(now); const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
    const mon = new Date(d), sun = new Date(d); sun.setDate(sun.getDate() + 6)
    return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10),
      label: `${mon.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` }
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: d.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface ProjectReportProps {
  projectId: string
  projectName: string
}

export function ProjectReport({ projectId, projectName }: ProjectReportProps) {
  const [period, setPeriod] = useState<Period>('weekly')
  const [offset, setOffset] = useState(0)
  const [showLog, setShowLog] = useState(false)

  const { start, end, label } = useMemo(() => getRange(period, offset), [period, offset])
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)
  const { data: projectStatus } = useProjectStatus(projectId)

  // Filter to this project only
  const records: Attendance[] = useMemo(() => {
    if (!rawRecords) return []
    return rawRecords.map(r => {
      const filtered = r.sessions.filter(s => s.projectId === projectId)
      if (!filtered.length) return null
      return { ...r, sessions: filtered, totalHours: filtered.reduce((s, se) => s + (se.hours ?? 0), 0) }
    }).filter(Boolean) as Attendance[]
  }, [rawRecords, projectId])

  // ── Metrics ──
  const totalHours = useMemo(() => records.reduce((s, r) => s + r.sessions.reduce((ss, se) => ss + (se.hours ?? 0), 0), 0), [records])
  const totalMembers = useMemo(() => new Set(records.map(r => r.userId)).size, [records])
  const totalSessions = useMemo(() => records.reduce((s, r) => s + r.sessions.length, 0), [records])
  const totalEstimated = projectStatus?.totalEstimatedHours ?? 0

  // ── Hours by task ──
  const taskHours = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) for (const s of r.sessions) {
      const t = s.taskTitle || 'General'
      map.set(t, (map.get(t) ?? 0) + (s.hours ?? 0))
    }
    return Array.from(map.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => b.hours - a.hours)
  }, [records])

  const taskColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    taskHours.forEach((t, i) => { m[t.name] = COLORS[i % COLORS.length] })
    return m
  }, [taskHours])

  // ── Hours by member ──
  const memberHours = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; tasks: Map<string, number> }>()
    for (const r of records) {
      if (!map.has(r.userId)) map.set(r.userId, { name: r.userName || r.userEmail, hours: 0, tasks: new Map() })
      const entry = map.get(r.userId)!
      for (const s of r.sessions) {
        entry.hours += s.hours ?? 0
        const t = s.taskTitle || 'General'
        entry.tasks.set(t, (entry.tasks.get(t) ?? 0) + (s.hours ?? 0))
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records])

  // ── Status distribution (from projectStatus) ──
  const statusData = useMemo(() => {
    if (!projectStatus?.taskProgress) return []
    const counts = new Map<string, number>()
    for (const t of projectStatus.taskProgress) counts.set(t.status, (counts.get(t.status) ?? 0) + 1)
    return Array.from(counts.entries()).map(([status, count]) => ({ name: TASK_STATUS_LABEL[status as keyof typeof TASK_STATUS_LABEL] ?? status, value: count, status }))
  }, [projectStatus])

  // ── Estimated vs Actual ──
  const estVsActual = useMemo(() => {
    if (!projectStatus?.taskProgress) return []
    return projectStatus.taskProgress.map(t => ({
      name: t.title.length > 20 ? t.title.slice(0, 20) + '…' : t.title,
      fullName: t.title,
      estimated: t.estimatedHours ?? 0,
      tracked: t.trackedHours ?? 0,
      status: t.status,
    })).filter(t => t.estimated > 0 || t.tracked > 0)
  }, [projectStatus])

  // ── Detailed log ──
  const detailedRows = useMemo(() => {
    const rows: { date: string; member: string; task: string; signIn: string; signOut: string | null; hours: number | null }[] = []
    for (const r of records) for (const s of r.sessions) {
      rows.push({ date: r.date, member: r.userName || r.userEmail, task: s.taskTitle || 'General', signIn: s.signInAt, signOut: s.signOutAt, hours: s.hours })
    }
    return rows.sort((a, b) => new Date(b.signIn).getTime() - new Date(a.signIn).getTime())
  }, [records])

  const exportCSV = () => {
    const header = ['Date', 'Member', 'Project', 'Task', 'Start', 'End', 'Duration']
    const rows = detailedRows.map(r => [r.date, r.member, projectName, r.task, formatTime(r.signIn), r.signOut ? formatTime(r.signOut) : 'Active', r.hours != null ? formatDuration(r.hours) : '—'])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${projectName}-report-${start}-${end}.csv`; a.click()
  }

  const budgetPct = totalEstimated > 0 ? Math.round((totalHours / totalEstimated) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['weekly', 'monthly', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => { setPeriod(p); setOffset(0) }}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${period === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {period !== 'all' && (
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
        )}
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <>
          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tracked</p>
              </div>
              <p className="text-xl font-bold text-indigo-700 tabular-nums">{formatDuration(totalHours)}</p>
            </div>
            {totalEstimated > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white ${budgetPct > 100 ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-amber-500 to-amber-600'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Budget</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${budgetPct > 100 ? 'text-red-600' : 'text-amber-600'}`}>{budgetPct}%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatDuration(totalHours)} / {formatDuration(totalEstimated)}</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Members</p>
              </div>
              <p className="text-xl font-bold text-violet-700 tabular-nums">{totalMembers}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sessions</p>
              </div>
              <p className="text-xl font-bold text-blue-700 tabular-nums">{totalSessions}</p>
            </div>
          </div>

          {/* ── Charts: Task Hours + Status Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Hours by Task — Bar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-[13px] font-bold text-gray-700 mb-4">Hours by Task</h3>
              {taskHours.length === 0 ? <div className="flex items-center justify-center h-[250px] text-[13px] text-gray-300">No data</div> : (
                <ResponsiveContainer width="100%" height={Math.max(180, taskHours.length * 36)}>
                  <BarChart data={taskHours} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => v > 0 ? formatDuration(v) : '0'} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={100} />
                    <Tooltip formatter={(value) => [formatDuration(Number(value)), 'Hours']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="hours" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {taskHours.map((t, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status Distribution — Donut */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-[13px] font-bold text-gray-700 mb-4">Status Distribution</h3>
              {statusData.length === 0 ? <div className="flex items-center justify-center h-[250px] text-[13px] text-gray-300">No tasks</div> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                      {statusData.map(e => <Cell key={e.name} fill={STATUS_COLORS[e.status] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const e = payload[0]; const total = statusData.reduce((s, d) => s + d.value, 0)
                      const pct = total > 0 ? Math.round((Number(e.value) / total) * 100) : 0
                      return <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.payload?.fill }} /><span className="font-semibold text-gray-800">{e.name}</span></div>
                        <p className="text-gray-600">{e.value} task{Number(e.value) !== 1 ? 's' : ''}</p><p className="text-indigo-600 font-bold">{pct}%</p>
                      </div>
                    }} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Estimated vs Actual ── */}
          {estVsActual.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-[13px] font-bold text-gray-700 mb-4">Estimated vs Actual Hours</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, estVsActual.length * 40)}>
                <BarChart data={estVsActual} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => v > 0 ? formatDuration(v) : '0'} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={120} />
                  <Tooltip formatter={(value) => [formatDuration(Number(value)), '']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="estimated" name="Estimated" fill="#c7d2fe" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  <Bar dataKey="tracked" name="Tracked" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[#c7d2fe]" /><span className="text-[11px] text-gray-500">Estimated</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[#6366f1]" /><span className="text-[11px] text-gray-500">Tracked</span></div>
              </div>
            </div>
          )}

          {/* ── Member Workload ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <h3 className="text-[13px] font-bold text-gray-800">Member Workload</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {memberHours.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-gray-300">No data</div>
              ) : memberHours.map((m, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[13px] font-semibold text-gray-800 flex-1">{m.name}</span>
                    <span className="text-[12px] font-bold text-gray-700 tabular-nums">{formatDuration(m.hours)}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{totalHours > 0 ? Math.round((m.hours / totalHours) * 100) : 0}%</span>
                  </div>
                  {/* Task breakdown bar */}
                  <div className="flex rounded-full h-2 overflow-hidden bg-gray-100">
                    {Array.from(m.tasks.entries()).sort((a, b) => b[1] - a[1]).map(([task, hrs]) => (
                      <div key={task} className="h-full" title={`${task}: ${formatDuration(hrs)}`}
                        style={{ width: `${m.hours > 0 ? (hrs / m.hours) * 100 : 0}%`, backgroundColor: taskColorMap[task] || '#94a3b8' }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {Array.from(m.tasks.entries()).sort((a, b) => b[1] - a[1]).map(([task, hrs]) => (
                      <span key={task} className="text-[10px] text-gray-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: taskColorMap[task] || '#94a3b8' }} />
                        {task} <span className="tabular-nums font-medium text-gray-500">{formatDuration(hrs)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Session Log (collapsible) ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setShowLog(!showLog)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showLog ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <h3 className="text-[13px] font-bold text-gray-800">Session Log</h3>
                <span className="text-[11px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-md tabular-nums">{detailedRows.length}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); exportCSV() }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
              </button>
            </button>
            {showLog && (
              <div className="border-t border-gray-50">
                <div className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2 px-5 py-2 bg-gray-50/70 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <span>Date</span><span>Member</span><span>Task</span><span>Start</span><span>End</span><span className="text-right">Duration</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
                  {detailedRows.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[13px] text-gray-300">No sessions</div>
                  ) : detailedRows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[90px_1fr_1fr_80px_80px_70px] gap-2 items-center px-5 py-2 hover:bg-gray-50/50 transition-colors text-[11px]">
                      <span className="text-gray-500">{formatDateShort(r.date)}</span>
                      <span className="font-medium text-gray-800 truncate">{r.member}</span>
                      <span className="text-gray-600 truncate">{r.task}</span>
                      <span className="text-gray-500 font-mono tabular-nums">{formatTime(r.signIn)}</span>
                      <span className="text-gray-500 font-mono tabular-nums">{r.signOut ? formatTime(r.signOut) : <span className="text-emerald-600 font-sans font-medium">Active</span>}</span>
                      <span className="text-right font-semibold text-gray-700 tabular-nums">{r.hours != null ? formatDuration(r.hours) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
