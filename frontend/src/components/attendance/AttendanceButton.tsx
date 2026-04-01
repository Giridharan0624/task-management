'use client'

import { useState, useMemo } from 'react'
import { useMyAttendance, useSignIn, useSignOut } from '@/lib/hooks/useAttendance'
import { useProjects } from '@/lib/hooks/useProjects'
import { useTasks, useDirectTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LiveTimer } from './LiveTimer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { formatDuration } from '@/lib/utils/formatDuration'
import { useLiveHours } from '@/lib/hooks/useLiveHours'

const DAILY_TARGET_HOURS = 8

const TASK_COLORS = [
  '#6366f1', '#8b5cf6', '#f97316', '#14b8a6',
  '#ec4899', '#3b82f6', '#f59e0b', '#10b981',
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function TaskSelector({
  onStart, loading, buttonLabel,
}: {
  onStart: (data: { taskId: string; projectId: string; taskTitle: string; projectName: string; description?: string }) => void
  loading: boolean; buttonLabel: string
}) {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: directTasks } = useDirectTasks()
  const [source, setSource] = useState('')
  const [taskId, setTaskId] = useState('')
  const [description, setDescription] = useState('')
  const { data: projectTasks } = useTasks(source === 'DIRECT' ? '' : source)

  // Timer only shows tasks assigned to the user — admins track their own work
  const availableTasks = source === 'DIRECT'
    ? (directTasks ?? []).filter(t => t.assignedTo.includes(user?.userId ?? ''))
    : (projectTasks ?? []).filter(t => t.assignedTo.includes(user?.userId ?? ''))

  const isMeeting = source === 'MEETING'
  const selectedTask = isMeeting ? null : availableTasks.find(t => t.taskId === taskId)
  const selectedProject = (projects ?? []).find(p => p.projectId === source)

  const handleStart = () => {
    if (isMeeting) {
      onStart({
        taskId: 'meeting',
        projectId: 'DIRECT',
        taskTitle: 'Meeting',
        projectName: 'Meeting',
        description: description.trim() || undefined,
      })
      setSource(''); setTaskId(''); setDescription('')
      return
    }
    if (!selectedTask) return
    onStart({
      taskId: selectedTask.taskId,
      projectId: source === 'DIRECT' ? 'DIRECT' : (selectedProject?.projectId ?? ''),
      taskTitle: selectedTask.title,
      projectName: source === 'DIRECT' ? 'Direct Task' : (selectedProject?.name ?? ''),
      description: description.trim() || undefined,
    })
    setSource(''); setTaskId(''); setDescription('')
  }

  const canStart = isMeeting || (taskId && source)

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What are you working on?"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white focus:border-indigo-400 transition-all"
        onKeyDown={e => { if (e.key === 'Enter' && canStart) handleStart() }}
      />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Select value={source} onChange={v => { setSource(v); setTaskId('') }}
          options={[
            { value: 'MEETING', label: 'Meeting' },
            { value: 'DIRECT', label: 'Direct Tasks' },
            ...(projects ?? []).map(p => ({ value: p.projectId, label: p.name })),
          ]}
          placeholder="Select Source" className="sm:flex-1" />
        {!isMeeting && (
          <Select value={taskId} onChange={setTaskId}
            options={availableTasks.map(t => ({ value: t.taskId, label: t.title }))}
            placeholder="Select Task" disabled={!source} className="sm:flex-1" />
        )}
        <Button variant="primary" size="sm" onClick={handleStart}
          disabled={!canStart || loading} loading={loading} className="whitespace-nowrap">
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

/* ─── Daily Target Ring ─── */
function DailyTargetRing({ hours }: { hours: number }) {
  const pct = Math.min((hours / DAILY_TARGET_HOURS) * 100, 100)
  const color = pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b'
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

/* ─── Daily Summary ─── */
function DailySummary({ sessions }: { sessions: { taskTitle: string | null; projectName: string | null; hours: number | null; signInAt: string; signOutAt: string | null }[] }) {
  const taskBreakdown = useMemo(() => {
    const map = new Map<string, { task: string; project: string; hours: number }>()
    for (const s of sessions) {
      const key = s.taskTitle || 'General'
      const ex = map.get(key)
      if (ex) ex.hours += s.hours ?? 0
      else map.set(key, { task: key, project: s.projectName || 'No Project', hours: s.hours ?? 0 })
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [sessions])

  const totalHrs = taskBreakdown.reduce((s, t) => s + t.hours, 0)
  if (taskBreakdown.length === 0) return null

  return (
    <div className="space-y-1.5">
      {taskBreakdown.map((t, i) => (
        <div key={t.task} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TASK_COLORS[i % TASK_COLORS.length] }} />
          <span className="text-[11px] text-gray-600 flex-1 truncate">{t.task}</span>
          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
            <div className="h-full rounded-full" style={{ width: `${totalHrs > 0 ? (t.hours / totalHrs) * 100 : 0}%`, backgroundColor: TASK_COLORS[i % TASK_COLORS.length] }} />
          </div>
          <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-12 text-right">{formatDuration(t.hours)}</span>
        </div>
      ))}
    </div>
  )
}

function SwitchSection({ onStart, loading }: { onStart: (data: { taskId: string; projectId: string; taskTitle: string; projectName: string; description?: string }) => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t border-emerald-200 pt-2">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 transition-colors select-none">
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Switch task
      </button>
      {open && (
        <div className="mt-2 animate-fade-in" style={{ animationDuration: '0.15s' }}>
          <TaskSelector onStart={onStart} loading={loading} buttonLabel="Switch" />
        </div>
      )}
    </div>
  )
}

export function AttendanceButton() {
  const { data: attendance, isLoading } = useMyAttendance()
  const { totalHours: liveTotal } = useLiveHours()
  const signIn = useSignIn()
  const signOut = useSignOut()

  // Last task for quick-restart
  const lastSession = attendance?.sessions?.filter(s => s.signOutAt)?.slice(-1)[0]

  if (isLoading) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-center"><Spinner /></div>
  }

  if (!attendance) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Time Tracker</p>
            <p className="text-[11px] text-gray-400">Select a project and task to start tracking</p>
          </div>
          <DailyTargetRing hours={0} />
        </div>
        <TaskSelector onStart={data => signIn.mutate(data)} loading={signIn.isPending} buttonLabel="Start" />
        {signIn.error && <p className="mt-2 text-[12px] text-red-600">{signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}</p>}
      </div>
    )
  }

  const { sessions, status, currentSignInAt, currentTask } = attendance

  if (status === 'SIGNED_IN') {
    const activeDesc = sessions.find(s => !s.signOutAt)?.description
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
        {/* Active timer — single row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-emerald-800 truncate">
                {currentTask?.taskTitle || 'Working'}
                {currentTask && <span className="text-emerald-600 font-normal"> · {currentTask.projectName}</span>}
              </p>
              {activeDesc && <p className="text-[11px] text-emerald-600/70 truncate italic">{activeDesc}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
            <span className="text-[10px] text-emerald-600 tabular-nums hidden sm:inline">{formatDuration(liveTotal)} today</span>
            {currentSignInAt && (
              <LiveTimer startTime={currentSignInAt} className="text-xl font-bold text-emerald-700 font-mono tracking-tight" />
            )}
            <Button variant="danger" size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>Stop</Button>
          </div>
        </div>

        {/* Switch — custom collapsible */}
        <SwitchSection onStart={data => signIn.mutate(data)} loading={signIn.isPending} />

        {(signIn.error || signOut.error) && (
          <p className="mt-2 text-[12px] text-red-600">{((signIn.error || signOut.error) as Error)?.message || 'Operation failed'}</p>
        )}
      </div>
    )
  }

  // Signed out — compact: resume button + start new
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-gray-900">Time Tracker</p>
          <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-1.5 py-0.5 rounded-md tabular-nums">{formatDuration(liveTotal)}</span>
        </div>
        {/* Quick restart */}
        {lastSession && lastSession.taskTitle && (
          <button
            onClick={() => signIn.mutate({
              taskId: lastSession.taskId!, projectId: lastSession.projectId!,
              taskTitle: lastSession.taskTitle!, projectName: lastSession.projectName!,
            })}
            disabled={signIn.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            Resume {lastSession.taskTitle}
          </button>
        )}
      </div>

      {/* Start new timer */}
      <TaskSelector onStart={data => signIn.mutate(data)} loading={signIn.isPending} buttonLabel="Start" />

      {signIn.error && <p className="mt-2 text-[12px] text-red-600">{signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}</p>}
    </div>
  )
}
