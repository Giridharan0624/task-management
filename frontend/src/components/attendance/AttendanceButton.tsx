'use client'

import { useState } from 'react'
import { useMyAttendance, useSignIn, useSignOut } from '@/lib/hooks/useAttendance'
import { useProjects } from '@/lib/hooks/useProjects'
import { useTasks, useDirectTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LiveTimer } from './LiveTimer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

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

  // Get tasks based on selected source
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

  return (
    <div className="flex items-center gap-2">
      <select
        className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all"
        value={source}
        onChange={(e) => { setSource(e.target.value); setTaskId('') }}
      >
        <option value="">Select Source</option>
        <option value="DIRECT">Direct Tasks</option>
        {(projects ?? []).map((p) => (
          <option key={p.projectId} value={p.projectId}>{p.name}</option>
        ))}
      </select>
      <select
        className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all"
        disabled={!source}
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        <option value="">Select Task</option>
        {availableTasks.map((t) => (
          <option key={t.taskId} value={t.taskId}>{t.title}</option>
        ))}
      </select>
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Not signed in today — show task selector to start
  if (!attendance) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Time Tracker</p>
            <p className="text-xs text-gray-500">Select a project and task to start tracking</p>
          </div>
        </div>
        <TaskSelector
          onStart={(data) => signIn.mutate(data)}
          loading={signIn.isPending}
          buttonLabel="Start"
        />
        {signIn.error && (
          <p className="mt-2 text-sm text-red-600">
            {signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}
          </p>
        )}
      </div>
    )
  }

  const { sessions, totalHours, status, currentSignInAt, currentTask } = attendance

  // Timer is running
  if (status === 'SIGNED_IN') {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 shadow-sm">
        {/* Active timer */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <p className="text-sm font-medium text-green-800">
                {currentTask ? currentTask.taskTitle : 'Working'}
              </p>
            </div>
            {currentTask && (
              <p className="text-xs text-green-600 mt-0.5 ml-4">{currentTask.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentSignInAt && (
              <LiveTimer startTime={currentSignInAt} className="text-2xl font-bold text-green-700 font-mono" />
            )}
            <Button variant="danger" size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>
              Stop
            </Button>
          </div>
        </div>

        {/* Switch task */}
        <div className="border-t border-green-200 pt-3">
          <p className="text-xs font-medium text-green-700 mb-2">Switch to another task:</p>
          <TaskSelector
            onStart={(data) => signIn.mutate(data)}
            loading={signIn.isPending}
            buttonLabel="Switch"
          />
        </div>

        {/* Today's summary */}
        {sessions.length > 1 && (
          <div className="border-t border-green-200 pt-3 mt-3">
            <p className="text-xs text-green-600">{sessions.length} sessions today &middot; {totalHours.toFixed(1)}h logged</p>
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

  // Signed out — show history + restart
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Time Tracker</p>
          <p className="text-xs text-gray-500">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} today &middot; {totalHours.toFixed(1)}h total
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-700">{totalHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Session history */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sessions.map((s, i) => (
          <div
            key={i}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
          >
            <span className="font-medium">{s.taskTitle || 'General'}</span>
            {': '}
            {formatTime(s.signInAt)}
            {s.signOutAt ? ` — ${formatTime(s.signOutAt)}` : ' — now'}
            {s.hours != null && ` (${s.hours.toFixed(1)}h)`}
          </div>
        ))}
      </div>

      {/* Start new timer */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-700 mb-2">Start a new timer:</p>
        <TaskSelector
          onStart={(data) => signIn.mutate(data)}
          loading={signIn.isPending}
          buttonLabel="Start"
        />
      </div>

      {signIn.error && (
        <p className="mt-2 text-sm text-red-600">
          {signIn.error instanceof Error ? signIn.error.message : 'Failed to start timer'}
        </p>
      )}
    </div>
  )
}
