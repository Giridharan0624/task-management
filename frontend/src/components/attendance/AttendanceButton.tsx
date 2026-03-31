'use client'

import { useState } from 'react'
import { useMyAttendance, useSignIn, useSignOut } from '@/lib/hooks/useAttendance'
import { useProjects } from '@/lib/hooks/useProjects'
import { useTasks, useDirectTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LiveTimer } from './LiveTimer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Select'
import { formatDuration } from '@/lib/utils/formatDuration'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function TaskSelector({
  onStart,
  loading,
  buttonLabel,
}: {
  onStart: (data: { taskId: string; projectId: string; taskTitle: string; projectName: string }) => void
  loading: boolean
  buttonLabel: string
}) {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: directTasks } = useDirectTasks()
  const [source, setSource] = useState('')
  const [taskId, setTaskId] = useState('')
  const { data: projectTasks } = useTasks(source === 'DIRECT' ? '' : source)

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'CEO' || user?.systemRole === 'MD' || user?.systemRole === 'ADMIN'

  const availableTasks = source === 'DIRECT'
    ? (directTasks ?? []).filter((t) => isPrivileged || t.assignedTo.includes(user?.userId ?? ''))
    : (projectTasks ?? []).filter((t) => isPrivileged || t.assignedTo.includes(user?.userId ?? ''))

  const selectedTask = availableTasks.find((t) => t.taskId === taskId)
  const selectedProject = (projects ?? []).find((p) => p.projectId === source)

  const handleStart = () => {
    if (!selectedTask) return
    onStart({
      taskId: selectedTask.taskId,
      projectId: source === 'DIRECT' ? 'DIRECT' : (selectedProject?.projectId ?? ''),
      taskTitle: selectedTask.title,
      projectName: source === 'DIRECT' ? 'Direct Task' : (selectedProject?.name ?? ''),
    })
    setSource('')
    setTaskId('')
  }

  const sourceOptions = [
    { value: 'DIRECT', label: 'Direct Tasks' },
    ...(projects ?? []).map((p) => ({ value: p.projectId, label: p.name })),
  ]
  const taskOptions = availableTasks.map((t) => ({ value: t.taskId, label: t.title }))

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <Select
        value={source}
        onChange={(v) => { setSource(v); setTaskId('') }}
        options={sourceOptions}
        placeholder="Select Source"
        className="sm:flex-1"
      />
      <Select
        value={taskId}
        onChange={setTaskId}
        options={taskOptions}
        placeholder="Select Task"
        disabled={!source}
        className="sm:flex-1"
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleStart}
        disabled={!taskId || !source || loading}
        loading={loading}
        className="whitespace-nowrap"
      >
        {buttonLabel}
      </Button>
    </div>
  )
}

export function AttendanceButton() {
  const { data: attendance, isLoading } = useMyAttendance()
  const signIn = useSignIn()
  const signOut = useSignOut()

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!attendance) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Time Tracker</p>
            <p className="text-xs text-gray-400">Select a project and task to start tracking</p>
          </div>
        </div>
        <TaskSelector onStart={(data) => signIn.mutate(data)} loading={signIn.isPending} buttonLabel="Start" />
        {signIn.error && (
          <p className="mt-2 text-sm text-red-600">
            {signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}
          </p>
        )}
      </div>
    )
  }

  const { sessions, totalHours, status, currentSignInAt, currentTask } = attendance

  if (status === 'SIGNED_IN') {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <p className="text-sm font-semibold text-emerald-800">
                {currentTask?.taskTitle || 'Working'}
              </p>
            </div>
            {currentTask && (
              <p className="text-xs text-emerald-600 mt-0.5 ml-4">{currentTask.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentSignInAt && (
              <LiveTimer startTime={currentSignInAt} className="text-2xl font-bold text-emerald-700 font-mono tracking-tight" />
            )}
            <Button variant="danger" size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>
              Stop
            </Button>
          </div>
        </div>

        <div className="border-t border-emerald-200 pt-3">
          <p className="text-xs font-semibold text-emerald-700 mb-2">Switch to another task:</p>
          <TaskSelector onStart={(data) => signIn.mutate(data)} loading={signIn.isPending} buttonLabel="Switch" />
        </div>

        {sessions.length > 1 && (
          <div className="border-t border-emerald-200 pt-3 mt-3">
            <p className="text-xs text-emerald-600">{sessions.length} sessions today &middot; {formatDuration(totalHours)} logged</p>
          </div>
        )}

        {(signIn.error || signOut.error) && (
          <p className="mt-2 text-sm text-red-600">
            {((signIn.error || signOut.error) as Error)?.message || 'Operation failed'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Time Tracker</p>
          <p className="text-xs text-gray-400">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} today &middot; {formatDuration(totalHours)} total
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-700 tracking-tight">{formatDuration(totalHours)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {sessions.map((s, i) => (
          <div key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
            <span className="font-semibold">{s.taskTitle || 'General'}</span>
            {': '}
            {formatTime(s.signInAt)}
            {s.signOutAt ? ` — ${formatTime(s.signOutAt)}` : ' — now'}
            {s.hours != null && ` (${formatDuration(s.hours)})`}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-700 mb-2">Start a new timer:</p>
        <TaskSelector onStart={(data) => signIn.mutate(data)} loading={signIn.isPending} buttonLabel="Start" />
      </div>

      {signIn.error && (
        <p className="mt-2 text-sm text-red-600">
          {signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}
        </p>
      )}
    </div>
  )
}
