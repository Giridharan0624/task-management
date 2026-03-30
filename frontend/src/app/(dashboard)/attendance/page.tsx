'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { Attendance } from '@/types/attendance'

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function generateCSV(records: Attendance[]): string {
  const rows: string[][] = [
    ['Name', 'Email', 'Role', 'Date', 'Session #', 'Task', 'Project', 'Start', 'End', 'Hours'],
  ]
  for (const r of records) {
    for (let i = 0; i < r.sessions.length; i++) {
      const s = r.sessions[i]
      rows.push([
        r.userName, r.userEmail, r.systemRole, r.date, String(i + 1),
        s.taskTitle || 'General', s.projectName || '-',
        formatTime(s.signInAt), s.signOutAt ? formatTime(s.signOutAt) : 'Active',
        s.hours != null ? s.hours.toFixed(2) : '-',
      ])
    }
  }
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const selectClass = "rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none transition-all hover:border-gray-300"

export default function AttendancePage() {
  const { user } = useAuth()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const { start, end } = getMonthRange(selectedYear, selectedMonth)
  const { data: records, isLoading } = useAttendanceReport(start, end)

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const handleDownload = () => {
    if (!records || records.length === 0) return
    const csv = generateCSV(records)
    downloadCSV(csv, `attendance-report-${start}-to-${end}.csv`)
  }

  const userStats = new Map<string, { name: string; email: string; role: string; days: number; totalHours: number }>()
  for (const r of records ?? []) {
    const existing = userStats.get(r.userId)
    if (existing) { existing.days += 1; existing.totalHours += r.totalHours }
    else { userStats.set(r.userId, { name: r.userName, email: r.userEmail, role: r.systemRole, days: 1, totalHours: r.totalHours }) }
  }

  const taskStats = new Map<string, { userName: string; taskTitle: string; projectName: string; totalHours: number; sessions: number }>()
  for (const r of records ?? []) {
    for (const s of r.sessions) {
      if (!s.taskId) continue
      const key = `${r.userId}::${s.taskId}`
      const existing = taskStats.get(key)
      const hrs = s.hours ?? 0
      if (existing) { existing.totalHours += hrs; existing.sessions += 1 }
      else { taskStats.set(key, { userName: r.userName, taskTitle: s.taskTitle || 'Unknown', projectName: s.projectName || '-', totalHours: hrs, sessions: 1 }) }
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2026, i).toLocaleString('en-US', { month: 'long' }),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isPrivileged ? 'Team Attendance Report' : 'My Attendance Report'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={String(selectedMonth)}
            onChange={(v) => setSelectedMonth(Number(v))}
            options={months.map((m) => ({ value: String(m.value), label: m.label }))}
            className="w-36"
          />
          <Select
            value={String(selectedYear)}
            onChange={(v) => setSelectedYear(Number(v))}
            options={[2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
            className="w-24"
          />
          <Button onClick={handleDownload} disabled={!records || records.length === 0}>
            Download CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Monthly Summary per User */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Monthly Summary</h2>
            {userStats.size === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-8 text-center">
                <p className="text-gray-400 text-sm">No attendance records for {monthLabel}.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Role</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Days Present</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Hours</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Avg Hours/Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from(userStats.entries()).map(([userId, stats]) => (
                      <tr key={userId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-gray-900">{stats.name}</p>
                          <p className="text-xs text-gray-400">{stats.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{stats.role}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{stats.days}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-indigo-600">{stats.totalHours.toFixed(1)}h</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {stats.days > 0 ? (stats.totalHours / stats.days).toFixed(1) : '0'}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Per-Task Breakdown */}
          {taskStats.size > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Per-Task Breakdown</h2>
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Project</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Task</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sessions</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from(taskStats.entries()).map(([key, stats]) => (
                      <tr key={key} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-gray-900">{stats.userName}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{stats.projectName}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{stats.taskTitle}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{stats.sessions}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-indigo-600">{stats.totalHours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily Records */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Daily Records</h2>
            {(records ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm">No records.</p>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sessions</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(records ?? []).map((r, idx) => (
                      <tr key={`${r.userId}-${r.date}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-gray-900 whitespace-nowrap">{r.date}</td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-gray-900">{r.userName}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {r.sessions.map((s, i) => (
                              <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-100 font-medium">
                                {s.taskTitle ? `${s.taskTitle}: ` : ''}
                                {formatTime(s.signInAt)}
                                {s.signOutAt ? ` — ${formatTime(s.signOutAt)}` : ' — active'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{r.totalHours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
