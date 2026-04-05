'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAttendanceReport, useMyAttendance } from '@/lib/hooks/useAttendance'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { Attendance } from '@/types/attendance'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'

/** Calculate total hours for an attendance record, using live elapsed for active sessions */
function getRecordHours(r: Attendance): number {
  return r.sessions.reduce((sum, s) => sum + getSessionHours(s), 0)
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function generateCSV(records: Attendance[]): string {
  const rows: string[][] = [['Name', 'Email', 'Role', 'Date', 'Session #', 'Task', 'Project', 'Description', 'Start', 'End', 'Duration']]
  for (const r of records) {
    for (let i = 0; i < r.sessions.length; i++) {
      const s = r.sessions[i]
      rows.push([r.userName, r.userEmail, r.systemRole, r.date, String(i + 1), s.taskTitle || 'General', s.projectName || '-', s.description || '', formatTime(s.signInAt), s.signOutAt ? formatTime(s.signOutAt) : 'Active', formatDuration(getSessionHours(s))])
    }
  }
  return rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function AttendancePage() {
  const { user } = useAuth()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [memberFilter, setMemberFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const { start, end } = getMonthRange(selectedYear, selectedMonth)
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)
  const { data: myAttendance } = useMyAttendance()
  const hasActiveSession = myAttendance?.status === 'SIGNED_IN'

  // Tick every second when there's an active session so live times update
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!hasActiveSession) return
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [hasActiveSession])

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Filter records
  const records = useMemo(() => {
    let r = rawRecords ?? []
    if (memberFilter !== 'ALL') r = r.filter(rec => rec.userId === memberFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(rec => rec.userName.toLowerCase().includes(q) || rec.userEmail.toLowerCase().includes(q))
    }
    return r
  }, [rawRecords, memberFilter, search])

  // Member options
  const memberOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rawRecords ?? []) map.set(r.userId, r.userName || r.userEmail)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawRecords])

  // Stats — use getRecordHours so active sessions show live elapsed time
  const totalHours = useMemo(() => records.reduce((s, r) => s + getRecordHours(r), 0), [records])
  const totalSessions = useMemo(() => records.reduce((s, r) => s + r.sessions.length, 0), [records])
  const uniqueMembers = useMemo(() => new Set(records.map(r => r.userId)).size, [records])
  const uniqueDays = useMemo(() => new Set(records.map(r => r.date)).size, [records])
  const avgPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0

  // User summary
  const userStats = useMemo(() => {
    const map = new Map<string, { name: string; email: string; role: string; days: number; totalHours: number; sessions: number }>()
    for (const r of records) {
      const ex = map.get(r.userId)
      const sessCount = r.sessions.length
      const hrs = getRecordHours(r)
      if (ex) { ex.days += 1; ex.totalHours += hrs; ex.sessions += sessCount }
      else map.set(r.userId, { name: r.userName, email: r.userEmail, role: r.systemRole, days: 1, totalHours: hrs, sessions: sessCount })
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
  }, [records])

  // Task stats
  const taskStats = useMemo(() => {
    const map = new Map<string, { userName: string; taskTitle: string; projectName: string; totalHours: number; sessions: number }>()
    for (const r of records) for (const s of r.sessions) {
      if (!s.taskId) continue
      const key = `${r.userId}::${s.taskId}`
      const ex = map.get(key)
      const hrs = getSessionHours(s)
      if (ex) { ex.totalHours += hrs; ex.sessions += 1 }
      else map.set(key, { userName: r.userName, taskTitle: s.taskTitle || 'Unknown', projectName: s.projectName || '-', totalHours: hrs, sessions: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
  }, [records])

  const toggleRow = (key: string) => {
    setExpandedRows(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const handleDownload = () => {
    if (!records.length) return
    const csv = generateCSV(records)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `attendance-${start}-to-${end}.csv`; a.click()
  }

  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2026, i).toLocaleString('en-US', { month: 'long' }) }))

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            {isPrivileged ? 'Team Attendance' : 'My Attendance'}
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedMonth)} onChange={v => setSelectedMonth(Number(v))} options={months} className="w-32" />
          <Select value={String(selectedYear)} onChange={v => setSelectedYear(Number(v))}
            options={[2025, 2026, 2027].map(y => ({ value: String(y), label: String(y) }))} className="w-20" />
          <button onClick={handleDownload} disabled={!records.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV
          </button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-indigo-700 tabular-nums">{formatDuration(totalHours)}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Total Hours</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-violet-700 tabular-nums">{uniqueMembers}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Members</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-blue-700 tabular-nums">{totalSessions}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Sessions</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatDuration(avgPerDay)}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Avg / Day</p>
            </div>
          </div>

          {/* Search + Member filter */}
          {isPrivileged && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[280px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[12px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-all" />
              </div>
              <FilterSelect value={memberFilter} onChange={setMemberFilter} active={memberFilter !== 'ALL'}
                options={[{ value: 'ALL', label: 'All Members' }, ...memberOptions.map(m => ({ value: m.id, label: m.name }))]} />
              {(search || memberFilter !== 'ALL') && (
                <button onClick={() => { setSearch(''); setMemberFilter('ALL') }} className="text-[11px] text-gray-400 hover:text-gray-600 font-medium">Clear</button>
              )}
            </div>
          )}

          {/* Monthly Summary */}
          {userStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50">
                <h3 className="text-[13px] font-bold text-gray-800">Monthly Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50/60 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="text-left px-5 py-2.5">Member</th>
                      <th className="text-left px-5 py-2.5">Role</th>
                      <th className="text-center px-5 py-2.5">Days</th>
                      <th className="text-center px-5 py-2.5">Sessions</th>
                      <th className="text-right px-5 py-2.5">Total</th>
                      <th className="text-right px-5 py-2.5">Avg/Day</th>
                      <th className="text-left px-5 py-2.5 min-w-[120px]">Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {userStats.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-800">{s.name}</p>
                          <p className="text-[10px] text-gray-400">{s.email}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{s.role}</td>
                        <td className="px-5 py-3 text-center font-semibold text-gray-700 tabular-nums">{s.days}</td>
                        <td className="px-5 py-3 text-center text-gray-500 tabular-nums">{s.sessions}</td>
                        <td className="px-5 py-3 text-right font-bold text-indigo-600 tabular-nums">{formatDuration(s.totalHours)}</td>
                        <td className="px-5 py-3 text-right text-gray-500 tabular-nums">{formatDuration(s.days > 0 ? s.totalHours / s.days : 0)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${totalHours > 0 ? (s.totalHours / totalHours) * 100 : 0}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{totalHours > 0 ? Math.round((s.totalHours / totalHours) * 100) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-Task Breakdown */}
          {taskStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-gray-800">Task Breakdown</h3>
                <span className="text-[11px] text-gray-400 tabular-nums">{taskStats.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50/60 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="text-left px-5 py-2.5">Member</th>
                      <th className="text-left px-5 py-2.5">Project</th>
                      <th className="text-left px-5 py-2.5">Task</th>
                      <th className="text-center px-5 py-2.5">Sessions</th>
                      <th className="text-right px-5 py-2.5">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {taskStats.slice(0, 20).map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-2.5 text-gray-700">{s.userName}</td>
                        <td className="px-5 py-2.5 text-gray-500">{s.projectName}</td>
                        <td className="px-5 py-2.5 font-medium text-gray-800">{s.taskTitle}</td>
                        <td className="px-5 py-2.5 text-center text-gray-500 tabular-nums">{s.sessions}</td>
                        <td className="px-5 py-2.5 text-right font-bold text-indigo-600 tabular-nums">{formatDuration(s.totalHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily Records — expandable */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-gray-800">Daily Records</h3>
              <span className="text-[11px] text-gray-400 tabular-nums">{records.length} entries</span>
            </div>
            {records.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-gray-300">No attendance records for {monthLabel}</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((r, idx) => {
                  const key = `${r.userId}-${r.date}-${idx}`
                  const isOpen = expandedRows.has(key)
                  return (
                    <div key={key}>
                      <button onClick={() => toggleRow(key)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors text-left">
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-[12px] text-gray-500 tabular-nums min-w-[110px]">{formatDateLabel(r.date)}</span>
                        <span className="text-[12px] font-medium text-gray-800 flex-1 truncate">{r.userName}</span>
                        <span className="text-[11px] text-gray-400 tabular-nums">{r.sessions.length} session{r.sessions.length !== 1 ? 's' : ''}</span>
                        <span className="text-[12px] font-bold text-indigo-600 tabular-nums min-w-[70px] text-right">{formatDuration(getRecordHours(r))}</span>
                      </button>
                      {isOpen && (
                        <div className="bg-gray-50/60 px-5 pb-3">
                          <div className="grid grid-cols-[1fr_1fr_80px_80px_70px] gap-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>Task</span><span>Project</span><span>Start</span><span>End</span><span className="text-right">Duration</span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {r.sessions.map((s, j) => (
                              <div key={j} className="py-2 text-[11px]">
                                <div className="grid grid-cols-[1fr_1fr_80px_80px_70px] gap-2">
                                  <span className="text-gray-700 font-medium truncate">{s.taskTitle || 'General'}</span>
                                  <span className="text-gray-500 truncate">{s.projectName || '-'}</span>
                                  <span className="text-gray-500 font-mono tabular-nums">{formatTime(s.signInAt)}</span>
                                  <span className="text-gray-500 font-mono tabular-nums">{s.signOutAt ? formatTime(s.signOutAt) : <span className="text-emerald-600 font-sans font-medium">Active</span>}</span>
                                  <span className="text-right font-semibold text-gray-700 tabular-nums">{formatDuration(getSessionHours(s))}</span>
                                </div>
                                {s.description && <p className="text-[10px] text-gray-400 italic mt-0.5 pl-0.5">— {s.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
