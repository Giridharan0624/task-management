'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMyAttendance } from '@/lib/hooks/useAttendance'
import { LiveTimer } from './LiveTimer'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import type { AttendanceSession } from '@/types/attendance'

/* ═══ Grouped Task — merges multiple sessions of same task ═══ */
interface GroupedTask {
  taskTitle: string
  projectName: string
  description: string | null
  totalHours: number
  sessions: { signInAt: string; signOutAt: string | null; hours: number }[]
}

function groupSessionsByTask(sessions: AttendanceSession[]): GroupedTask[] {
  const map = new Map<string, GroupedTask>()
  for (const s of sessions) {
    const key = s.taskId || s.taskTitle || s.description || 'general'
    const hrs = getSessionHours(s)
    const start = new Date(s.signInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const end = s.signOutAt ? new Date(s.signOutAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null
    const existing = map.get(key)
    if (existing) {
      existing.totalHours += hrs
      existing.sessions.push({ signInAt: start, signOutAt: end, hours: hrs })
      if (s.description && !existing.description) existing.description = s.description
    } else {
      map.set(key, {
        taskTitle: s.taskTitle || s.description || 'General',
        projectName: s.projectName || 'Direct',
        description: s.description,
        totalHours: hrs,
        sessions: [{ signInAt: start, signOutAt: end, hours: hrs }],
      })
    }
  }
  return Array.from(map.values())
}

function SessionRow({ task }: { task: GroupedTask }) {
  return (
    <div className="px-4 py-3 hover:bg-gray-50/80 transition-colors">
      <div className="flex items-center gap-3">
        {/* Task info */}
        <div className="min-w-0 w-[140px] flex-shrink-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">{task.taskTitle}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 truncate">{task.projectName}</span>
            {task.description && task.taskTitle !== task.description && (
              <span className="text-[10px] text-gray-400 italic truncate">— {task.description}</span>
            )}
          </div>
        </div>

        {/* Session times */}
        <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {task.sessions.map((s, i) => (
            <span key={i} className={`text-[10px] tabular-nums font-mono ${s.signOutAt ? 'text-gray-400' : 'text-emerald-500'}`}>
              {s.signInAt}{s.signOutAt ? ` – ${s.signOutAt}` : ' – now'}
            </span>
          ))}
        </div>

        {/* Total duration */}
        <span className={`text-[13px] font-bold tabular-nums w-[80px] text-right flex-shrink-0 font-mono ${task.sessions.some(s => !s.signOutAt) ? 'text-emerald-600' : 'text-indigo-600'}`}>
          {formatDuration(task.totalHours)}
        </span>
      </div>
    </div>
  )
}

/* ═══ Main Timer (Read-Only) ═══ */
export function AttendanceButton() {
  const { data: attendance, isLoading } = useMyAttendance()

  // Tick every second for live calculations
  const [, tick] = useState(0)
  const active = attendance?.status === 'SIGNED_IN'
  useEffect(() => {
    if (!active) return
    const i = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [active])

  if (isLoading) return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-center"><Spinner /></div>

  const rawSessions = attendance?.sessions ?? []
  const sessions = (active && attendance?.currentSignInAt)
    ? rawSessions.map(s => (!s.signOutAt ? { ...s, signInAt: attendance.currentSignInAt! } : s))
    : rawSessions
  const totalHours = sessions.reduce((s, se) => s + getSessionHours(se), 0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupedTasks = useMemo(() => groupSessionsByTask(sessions), [sessions, totalHours])

  /* ─── ACTIVE (timer running from desktop) ─── */
  if (active && attendance) {
    const cur = attendance.currentTask
    const curSession = sessions.find(s => !s.signOutAt)

    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 shadow-sm overflow-hidden">
        {/* Running timer display */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-emerald-800 truncate">{cur?.taskTitle || 'Working'}</p>
              <p className="text-[11px] text-emerald-600 truncate">
                {cur?.projectName}{curSession?.description && <span className="italic"> — {curSession.description}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {attendance.currentSignInAt && <LiveTimer startTime={attendance.currentSignInAt} className="text-2xl font-bold text-emerald-700 font-mono tabular-nums" />}
          </div>
        </div>

        {/* Total bar */}
        <div className="px-5 py-2 bg-emerald-100/50 border-t border-emerald-200/50 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-emerald-700">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span className="text-[12px] font-bold text-emerald-700 tabular-nums font-mono">{formatDuration(totalHours)} today</span>
        </div>

        {/* Session list (read-only) */}
        {groupedTasks.length > 0 && (
          <div className="border-t border-emerald-200/50 bg-white/50 divide-y divide-gray-50">
            {groupedTasks.map((t, i) => (
              <SessionRow key={i} task={t} />
            ))}
          </div>
        )}

        {/* Desktop app hint */}
        <div className="px-5 py-2.5 border-t border-emerald-200/50 bg-white/50">
          <p className="text-[10px] text-emerald-600 text-center">
            Managed from <span className="font-semibold">Desktop App</span>
          </p>
        </div>
      </div>
    )
  }

  /* ─── STOPPED / NO DATA ─── */
  const hasSessions = groupedTasks.length > 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {hasSessions ? (
        <>
          {/* Header with total */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <p className="text-[13px] font-bold text-gray-900">Time Tracker</p>
              <p className="text-[11px] text-gray-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''} today</p>
            </div>
            <span className="text-[20px] font-bold text-gray-700 font-mono tabular-nums">{formatDuration(totalHours)}</span>
          </div>

          {/* Sessions */}
          <div className="divide-y divide-gray-50">
            {groupedTasks.map((t, i) => (
              <SessionRow key={i} task={t} />
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timer stopped</span>
            <p className="text-[10px] text-gray-400">Use <span className="font-semibold text-indigo-500">Desktop App</span> to resume</p>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-4 p-5">
          <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-gray-800">No Activity Today</p>
            <p className="text-[11px] text-gray-400">Start a timer from the Desktop App to begin tracking</p>
          </div>
        </div>
      )}
    </div>
  )
}
