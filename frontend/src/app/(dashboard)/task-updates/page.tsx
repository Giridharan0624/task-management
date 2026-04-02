'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTaskUpdates } from '@/lib/hooks/useTaskUpdates'
import { useUsers } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { DatePicker } from '@/components/ui/DatePicker'
import { Avatar } from '@/components/ui/AvatarUpload'
import type { TaskUpdate } from '@/types/taskupdate'

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTime(t: string): number {
  const hMatch = t.match(/(\d+)h/)
  const mMatch = t.match(/(\d+)m/)
  const sMatch = t.match(/(\d+)s/)
  return (hMatch ? parseInt(hMatch[1]) : 0) + (mMatch ? parseInt(mMatch[1]) / 60 : 0) + (sMatch ? parseInt(sMatch[1]) / 3600 : 0)
}

function formatHrs(h: number) {
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60)
  if (hrs === 0 && mins === 0) return '0m'
  return hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`
}

function UpdateCard({ update, avatarUrl }: { update: TaskUpdate; avatarUrl?: string }) {
  const totalHrs = parseTime(update.totalTime)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar url={avatarUrl} name={update.userName} size="md" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{update.userName}</p>
            {update.employeeId && <p className="text-[10px] font-mono text-gray-400">{update.employeeId}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{update.totalTime}</p>
          <p className="text-[10px] text-gray-400">total</p>
        </div>
      </div>

      {/* Sign in/out */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign In</p>
          <p className="text-sm font-semibold text-gray-900">{update.signIn}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign Out</p>
          <p className="text-sm font-semibold text-gray-900">{update.signOut}</p>
        </div>
      </div>

      {/* Tasks */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tasks</p>
        <div className="space-y-1.5">
          {update.taskSummary.map((t, i) => {
            const taskHrs = parseTime(t.timeRecorded)
            const pct = totalHrs > 0 ? (taskHrs / totalHrs) * 100 : 0
            return (
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-700 flex-1">{t.taskName}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-600 tabular-nums w-14 text-right">{t.timeRecorded}</span>
                  </div>
                </div>
                {t.description && <p className="text-[10px] text-gray-400 mt-0.5 italic">{t.description}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function TaskUpdatesPage() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [search, setSearch] = useState('')
  const { data: updates, isLoading } = useTaskUpdates(selectedDate)
  const { data: allUsers } = useUsers()

  const avatarMap = new Map<string, string | undefined>()
  for (const u of allUsers ?? []) { if (u.avatarUrl) avatarMap.set(u.userId, u.avatarUrl) }

  const canView = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  const filteredUpdates = useMemo(() => {
    if (!updates) return []
    if (!search.trim()) return updates
    const q = search.toLowerCase()
    return updates.filter(u => u.userName.toLowerCase().includes(q) || (u.employeeId || '').toLowerCase().includes(q))
  }, [updates, search])

  const totalMembers = filteredUpdates.length
  const totalHours = useMemo(() => filteredUpdates.reduce((s, u) => s + parseTime(u.totalTime), 0), [filteredUpdates])
  const avgHours = totalMembers > 0 ? totalHours / totalMembers : 0

  const today = getToday()
  const isToday = selectedDate === today
  const canGoNext = selectedDate < today

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  })

  const goBack = () => setSelectedDate(shiftDate(selectedDate, -1))
  const goForward = () => { if (canGoNext) setSelectedDate(shiftDate(selectedDate, 1)) }
  const goToday = () => setSelectedDate(today)

  const exportCSV = () => {
    if (!filteredUpdates.length) return
    const header = ['Name', 'Employee ID', 'Date', 'Sign In', 'Sign Out', 'Total Time', 'Tasks']
    const rows = filteredUpdates.map(u => [
      u.userName, u.employeeId || '', u.date, u.signIn, u.signOut, u.totalTime,
      u.taskSummary.map(t => `${t.taskName} (${t.timeRecorded})`).join('; '),
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `task-updates-${selectedDate}.csv`; a.click()
  }

  if (!canView) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">You don&apos;t have permission to view this page.</p></div>
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Task Updates</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Daily work summaries from team members</p>
        </div>
        <div className="flex items-center gap-2">
          {filteredUpdates.length > 0 && (
            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Date navigation — simplified */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2.5">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold text-gray-800">{dateLabel}</p>
          {!isToday && (
            <button onClick={goToday} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Go to today
            </button>
          )}
          <DatePicker value={selectedDate} onChange={setSelectedDate} max={today} className="w-36" />
        </div>
        <button onClick={goForward} disabled={!canGoNext}
          className={`p-2 rounded-xl transition-colors ${canGoNext ? 'hover:bg-gray-100 text-gray-500 hover:text-gray-700' : 'text-gray-200 cursor-not-allowed'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Stats + Search */}
      {!isLoading && (updates ?? []).length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-indigo-700 tabular-nums">{totalMembers}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Submitted</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatHrs(totalHours)}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Total Hours</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xl font-bold text-violet-700 tabular-nums">{formatHrs(avgHours)}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Avg / Person</p>
            </div>
          </div>

          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[12px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-all" />
          </div>
        </>
      )}

      {/* Updates grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-[14px] font-bold text-gray-800 mb-1">
            {search ? 'No matching updates' : 'No updates for this date'}
          </p>
          <p className="text-[12px] text-gray-400 max-w-xs mx-auto">
            {search
              ? `No task updates match "${search}"`
              : isToday
                ? 'Task updates will appear here as team members submit their daily summaries'
                : `No one submitted a task update on this date`
            }
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-3 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">Clear search</button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredUpdates.map(update => (
            <UpdateCard key={update.updateId} update={update} avatarUrl={avatarMap.get(update.userId)} />
          ))}
        </div>
      )}
    </div>
  )
}
