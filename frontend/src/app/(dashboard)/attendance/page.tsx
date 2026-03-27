'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { Button } from '@/components/ui/Button'
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

function generateCSV(records: Attendance[], monthLabel: string): string {
  const rows: string[][] = [
    ['Name', 'Email', 'Role', 'Date', 'Sessions', 'Session Details', 'Total Hours'],
  ]

  for (const r of records) {
    const sessionDetails = r.sessions
      .map((s, i) => {
        const inTime = formatTime(s.signInAt)
        const outTime = s.signOutAt ? formatTime(s.signOutAt) : 'Active'
        const hrs = s.hours != null ? `${s.hours.toFixed(2)}h` : '-'
        return `Session ${i + 1}: ${inTime} - ${outTime} (${hrs})`
      })
      .join(' | ')

    rows.push([
      r.userName,
      r.userEmail,
      r.systemRole,
      r.date,
      String(r.sessionCount),
      sessionDetails,
      r.totalHours.toFixed(2),
    ])
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

export default function AttendancePage() {
  const { user } = useAuth()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const { start, end } = getMonthRange(selectedYear, selectedMonth)
  const { data: records, isLoading } = useAttendanceReport(start, end)

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const handleDownload = () => {
    if (!records || records.length === 0) return
    const csv = generateCSV(records, monthLabel)
    downloadCSV(csv, `attendance-report-${start}-to-${end}.csv`)
  }

  // Aggregate stats per user
  const userStats = new Map<string, { name: string; email: string; role: string; days: number; totalHours: number }>()
  for (const r of records ?? []) {
    const existing = userStats.get(r.userId)
    if (existing) {
      existing.days += 1
      existing.totalHours += r.totalHours
    } else {
      userStats.set(r.userId, {
        name: r.userName,
        email: r.userEmail,
        role: r.systemRole,
        days: 1,
        totalHours: r.totalHours,
      })
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2026, i).toLocaleString('en-US', { month: 'long' }),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isPrivileged ? 'Team Attendance Report' : 'My Attendance Report'}
          </h1>
          <p className="text-gray-500 mt-1">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={!records || records.length === 0}
          >
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
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Monthly Summary</h2>
            {userStats.size === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
                <p className="text-gray-500 text-sm">No attendance records for {monthLabel}.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Present</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Hours/Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Array.from(userStats.entries()).map(([userId, stats]) => (
                      <tr key={userId} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{stats.name}</p>
                            <p className="text-xs text-gray-400">{stats.email}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">{stats.role}</td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{stats.days}</td>
                        <td className="px-5 py-3 text-sm font-medium text-indigo-700">{stats.totalHours.toFixed(1)}h</td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {stats.days > 0 ? (stats.totalHours / stats.days).toFixed(1) : '0'}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daily Records */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Daily Records</h2>
            {(records ?? []).length === 0 ? (
              <p className="text-gray-500 text-sm">No records.</p>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(records ?? []).map((r, idx) => (
                      <tr key={`${r.userId}-${r.date}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm text-gray-900 whitespace-nowrap">{r.date}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-900">{r.userName}</p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.sessions.map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {formatTime(s.signInAt)}
                                {s.signOutAt ? ` — ${formatTime(s.signOutAt)}` : ' — active'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.totalHours.toFixed(1)}h</td>
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
