'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMyAttendance, useSignIn, useSignOut } from '@/lib/hooks/useAttendance'
import { useProjects } from '@/lib/hooks/useProjects'
import { useTasks, useDirectTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LiveTimer } from './LiveTimer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import type { AttendanceSession } from '@/types/attendance'

/* ═══ Task Selector ═══ */
function TaskSelector({ onStart, loading, label }: {
  onStart: (d: { taskId: string; projectId: string; taskTitle: string; projectName: string; description?: string }) => void
  loading: boolean; label: string
}) {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: directTasks } = useDirectTasks()
  const [source, setSource] = useState('')
  const [taskId, setTaskId] = useState('')
  const [desc, setDesc] = useState('')
  const { data: projectTasks } = useTasks(source === 'DIRECT' ? '' : source)

  const tasks = source === 'DIRECT'
    ? (directTasks ?? []).filter(t => t.assignedTo.includes(user?.userId ?? ''))
    : (projectTasks ?? []).filter(t => t.assignedTo.includes(user?.userId ?? ''))

  const isMeeting = source === 'MEETING'
  const canStart = isMeeting || (taskId && source)

  const go = () => {
    if (isMeeting) {
      onStart({ taskId: 'meeting', projectId: 'DIRECT', taskTitle: 'Meeting', projectName: 'Meeting', description: desc.trim() || undefined })
    } else {
      const t = tasks.find(x => x.taskId === taskId)
      const p = (projects ?? []).find(x => x.projectId === source)
      if (!t) return
      onStart({ taskId: t.taskId, projectId: source === 'DIRECT' ? 'DIRECT' : (p?.projectId ?? ''), taskTitle: t.title, projectName: source === 'DIRECT' ? 'Direct Task' : (p?.name ?? ''), description: desc.trim() || undefined })
    }
    setSource(''); setTaskId(''); setDesc('')
  }

  return (
    <div className="space-y-2">
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What are you working on?"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white focus:border-indigo-400 transition-all"
        onKeyDown={e => { if (e.key === 'Enter' && canStart) go() }} />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Select value={source} onChange={v => { setSource(v); setTaskId('') }}
          options={[{ value: 'MEETING', label: 'Meeting' }, { value: 'DIRECT', label: 'Direct Tasks' }, ...(projects ?? []).map(p => ({ value: p.projectId, label: p.name }))]}
          placeholder="Select Source" className="sm:flex-1" />
        {!isMeeting && <Select value={taskId} onChange={setTaskId} options={tasks.map(t => ({ value: t.taskId, label: t.title }))} placeholder="Select Task" disabled={!source} className="sm:flex-1" />}
        <Button variant="primary" size="sm" onClick={go} disabled={!canStart || loading} loading={loading} className="whitespace-nowrap">{label}</Button>
      </div>
    </div>
  )
}

/* ═══ Grouped Task — merges multiple sessions of same task ═══ */
interface GroupedTask {
  taskTitle: string
  projectName: string
  taskId: string | null
  projectId: string | null
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
        taskId: s.taskId,
        projectId: s.projectId,
        description: s.description,
        totalHours: hrs,
        sessions: [{ signInAt: start, signOutAt: end, hours: hrs }],
      })
    }
  }
  return Array.from(map.values())
}

function TaskRow({ task, onResume, loading }: {
  task: GroupedTask
  onResume: () => void
  loading: boolean
}) {
  return (
    <div className="px-4 py-3 hover:bg-gray-50/80 transition-colors group">
      <div className="flex items-center gap-3">
        {/* Resume button */}
        <button onClick={onResume} disabled={loading}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 transition-all disabled:opacity-30 group-hover:scale-105"
          title="Resume this task">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </button>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">{task.taskTitle}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 truncate">{task.projectName}</span>
            {task.description && task.taskTitle !== task.description && (
              <span className="text-[10px] text-gray-400 italic truncate">— {task.description}</span>
            )}
          </div>
        </div>

        {/* Session times — shown inline */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {task.sessions.map((s, i) => (
            <span key={i} className="text-[10px] text-gray-400 tabular-nums font-mono">
              {s.signInAt}{s.signOutAt ? ` – ${s.signOutAt}` : ''}
            </span>
          ))}
        </div>

        {/* Total duration */}
        <span className="text-[13px] font-bold text-indigo-600 tabular-nums w-[70px] text-right flex-shrink-0">
          {formatDuration(task.totalHours)}
        </span>
      </div>
    </div>
  )
}

/* ═══ Main Timer ═══ */
export function AttendanceButton() {
  const { data: attendance, isLoading } = useMyAttendance()
  const signIn = useSignIn()
  const signOut = useSignOut()

  // Tick every second for live calculations
  const [, tick] = useState(0)
  const active = attendance?.status === 'SIGNED_IN'
  useEffect(() => {
    if (!active) return
    const i = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [active])

  if (isLoading) return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-center"><Spinner /></div>

  // Ensure the active session's signInAt matches currentSignInAt so all
  // time calculations stay consistent with the LiveTimer display
  const rawSessions = attendance?.sessions ?? []
  const sessions = (active && attendance?.currentSignInAt)
    ? rawSessions.map(s => (!s.signOutAt ? { ...s, signInAt: attendance.currentSignInAt! } : s))
    : rawSessions
  // In stopped state, ALL sessions are done — don't rely on signOutAt being set
  // In active state, filter out the currently running session (last one without signOutAt)
  const pastSessions = active
    ? sessions.filter(s => s.signOutAt)
    : sessions
  const totalHours = sessions.reduce((s, se) => s + getSessionHours(se), 0)

  // Group past sessions by task for the session list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupedTasks = useMemo(() => groupSessionsByTask(pastSessions), [pastSessions, totalHours])

  const resume = (task: GroupedTask) => {
    signIn.mutate({
      taskId: task.taskId || 'meeting',
      projectId: task.projectId || 'DIRECT',
      taskTitle: task.taskTitle,
      projectName: task.projectName || 'Direct Task',
      description: task.description || undefined,
    })
  }

  const err = signIn.error || signOut.error
  const errMsg = err instanceof Error ? err.message : err ? 'Operation failed' : null

  /* ─── ACTIVE ─── */
  if (active && attendance) {
    const cur = attendance.currentTask
    const curSession = sessions.find(s => !s.signOutAt)

    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 shadow-sm overflow-hidden">
        {/* Running timer */}
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
            <Button variant="danger" size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>Stop</Button>
          </div>
        </div>

        {/* Total bar */}
        <div className="px-5 py-2 bg-emerald-100/50 border-t border-emerald-200/50 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-emerald-700">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span className="text-[12px] font-bold text-emerald-700 tabular-nums">{formatDuration(totalHours)} today</span>
        </div>

        {/* Previous completed sessions — grouped by task */}
        {groupedTasks.length > 0 && (
          <div className="border-t border-emerald-200/50 bg-white/50 divide-y divide-gray-50">
            {groupedTasks.map((t, i) => (
              <TaskRow key={i} task={t} onResume={() => resume(t)} loading={signIn.isPending} />
            ))}
          </div>
        )}

        {/* Switch task */}
        <div className="px-5 py-3 border-t border-emerald-200/50 bg-white/50">
          <TaskSelector onStart={d => signIn.mutate(d)} loading={signIn.isPending} label="Switch" />
        </div>

        {errMsg && <p className="px-5 py-2 text-[12px] text-red-600 bg-red-50">{errMsg}</p>}
      </div>
    )
  }

  /* ─── STOPPED / NO DATA ─── */
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
        <div>
          <p className="text-[13px] font-bold text-gray-900">Time Tracker</p>
          {pastSessions.length > 0 && <p className="text-[11px] text-gray-400">{pastSessions.length} session{pastSessions.length !== 1 ? 's' : ''} today</p>}
        </div>
        <span className="text-[20px] font-bold text-gray-700 font-mono tabular-nums">{pastSessions.length > 0 ? formatDuration(totalHours) : '00:00:00'}</span>
      </div>

      {/* Today's sessions — grouped by task, each with resume button */}
      {groupedTasks.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-4 py-2 bg-gray-50/60 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today&apos;s Sessions</span>
          </div>
          <div className="divide-y divide-gray-50">
            {groupedTasks.map((t, i) => (
              <TaskRow key={i} task={t} onResume={() => resume(t)} loading={signIn.isPending} />
            ))}
          </div>
          {/* Total row */}
          <div className="px-4 py-2 bg-gray-50/60 flex items-center justify-between border-t border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
            <span className="text-[13px] font-bold text-gray-800 tabular-nums">{formatDuration(totalHours)}</span>
          </div>
        </div>
      )}

      {/* Start new */}
      <div className="p-5">
        <TaskSelector onStart={d => signIn.mutate(d)} loading={signIn.isPending} label="Start" />
      </div>

      {errMsg && <p className="px-5 pb-3 text-[12px] text-red-600">{errMsg}</p>}
    </div>
  )
}
