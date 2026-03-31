'use client'

import { useMyAttendance } from '@/lib/hooks/useAttendance'
import { useMyTaskUpdate, useSubmitTaskUpdate } from '@/lib/hooks/useTaskUpdates'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function TaskUpdateCard() {
  const { user } = useAuth()
  const { data: attendance, isLoading: attLoading } = useMyAttendance()
  const { data: existingUpdate, isLoading: updateLoading } = useMyTaskUpdate()
  const submitMutation = useSubmitTaskUpdate()

  if (attLoading || updateLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 flex justify-center">
        <Spinner />
      </div>
    )
  }

  // Pending yesterday's update (not yet submitted)
  const isPendingYesterday = existingUpdate && 'pendingDate' in existingUpdate && !(existingUpdate as any).submitted

  // Already submitted
  if (existingUpdate && !isPendingYesterday && 'updateId' in existingUpdate) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-bold text-emerald-700">Task Update Submitted</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-900">{existingUpdate.userName}</span>
            {existingUpdate.employeeId && (
              <span className="text-[10px] font-mono text-gray-400">{existingUpdate.employeeId}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign In</p>
              <p className="text-sm font-semibold text-gray-900">{existingUpdate.signIn}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign Out</p>
              <p className="text-sm font-semibold text-gray-900">{existingUpdate.signOut}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Task Summary</p>
            <div className="space-y-1.5">
              {existingUpdate.taskSummary.map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{i + 1}. {t.taskName}</span>
                  <span className="text-xs font-semibold text-indigo-600">{t.timeRecorded}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Time</span>
            <span className="text-lg font-bold text-gray-900">{existingUpdate.totalTime}</span>
          </div>
        </div>
      </div>
    )
  }

  // Pending yesterday's update — prompt to submit
  if (isPendingYesterday) {
    const pendingDate = (existingUpdate as any).pendingDate
    return (
      <div className="bg-white rounded-2xl border-2 border-amber-200 bg-amber-50/30 shadow-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <p className="text-sm font-bold text-amber-700">Pending Task Update</p>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          You have unsubmitted work from <span className="font-semibold">{pendingDate}</span>. Submit your task update now.
        </p>
        {submitMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Failed to submit'}
          </p>
        )}
        <Button
          className="w-full"
          onClick={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
        >
          Submit Task Update for {pendingDate}
        </Button>
      </div>
    )
  }

  // No attendance yet
  if (!attendance || !attendance.sessions || attendance.sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400">Start the timer to track your work before submitting a task update.</p>
      </div>
    )
  }

  // Build preview from attendance data
  const sessions = attendance.sessions
  const signIn = formatTime(sessions[0].signInAt)
  const lastSession = sessions[sessions.length - 1]
  const signOut = lastSession.signOutAt ? formatTime(lastSession.signOutAt) : 'Still working'

  const taskHours: Record<string, number> = {}
  for (const s of sessions) {
    const name = s.taskTitle || 'General'
    taskHours[name] = (taskHours[name] || 0) + (s.hours || 0)
  }

  const taskList = Object.entries(taskHours).map(([name, hours]) => {
    return { name, time: formatDuration(hours) }
  })

  const totalTime = formatDuration(attendance.totalHours)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
      <p className="text-sm font-bold text-gray-900 mb-4">Today&apos;s Task Update</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900">{user?.name || user?.email}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign In</p>
            <p className="text-sm font-semibold text-gray-900">{signIn}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign Out</p>
            <p className="text-sm font-semibold text-gray-900">{signOut}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Task Summary</p>
          <div className="space-y-1.5">
            {taskList.map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">{i + 1}. {t.name}</span>
                <span className="text-xs font-semibold text-indigo-600">{t.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Time</span>
          <span className="text-lg font-bold text-gray-900">{totalTime}</span>
        </div>

        {submitMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Failed to submit'}
          </p>
        )}

        <Button
          className="w-full"
          onClick={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
        >
          Submit Task Update
        </Button>
      </div>
    </div>
  )
}
