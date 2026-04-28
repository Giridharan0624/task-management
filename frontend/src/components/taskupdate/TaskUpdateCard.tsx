'use client'

import { useState, useEffect } from 'react'
import { useMyAttendance } from '@/lib/hooks/useAttendance'
import { useMyTaskUpdate, useSubmitTaskUpdate } from '@/lib/hooks/useTaskUpdates'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import type { Attendance, AttendanceSession } from '@/types/attendance'
import type { PendingTaskUpdate } from '@/types/taskupdate'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// Force re-render every second when timer is active
function useTick(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [active])
}

function isPending(data: unknown): data is PendingTaskUpdate {
  return !!data && typeof data === 'object' && 'pendingDate' in data && (data as any).submitted === false
}

/** Renders the task summary preview from attendance sessions */
function SessionPreview({ sessions, isTimerActive, label }: { sessions: AttendanceSession[]; isTimerActive: boolean; label?: string }) {
  const signIn = formatTime(sessions[0].signInAt)
  const lastSession = sessions[sessions.length - 1]
  const signOut = lastSession.signOutAt ? formatTime(lastSession.signOutAt) : 'Still working'
  const isStillWorking = !lastSession.signOutAt

  // Build task list
  const taskHours: Record<string, { hours: number; project: string; descriptions: string[] }> = {}
  for (const s of sessions) {
    const name = s.taskTitle || 'General'
    const project = s.projectName || 'Direct Task'
    const hrs = getSessionHours(s)
    if (taskHours[name]) {
      taskHours[name].hours += hrs
      if (s.description && !taskHours[name].descriptions.includes(s.description)) {
        taskHours[name].descriptions.push(s.description)
      }
    } else {
      taskHours[name] = { hours: hrs, project, descriptions: s.description ? [s.description] : [] }
    }
  }

  const taskList = Object.entries(taskHours).map(([name, v]) => ({ name, time: formatDuration(v.hours), project: v.project, descriptions: v.descriptions }))
  const totalHours = sessions.reduce((sum, s) => sum + getSessionHours(s), 0)

  // Group by project
  const projectMap = new Map<string, typeof taskList>()
  for (const t of taskList) {
    const arr = projectMap.get(t.project) ?? []
    arr.push(t)
    projectMap.set(t.project, arr)
  }
  const multipleProjects = projectMap.size > 1

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{label}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Sign In</p>
          <p className="text-sm font-semibold text-foreground">{signIn}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Sign Out</p>
          <p className={`text-sm font-semibold ${isStillWorking ? 'text-emerald-600' : 'text-foreground'}`}>{signOut}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">Task Summary</p>
        {Array.from(projectMap.entries()).map(([project, tasks]) => (
          <div key={project} className="mb-2">
            {multipleProjects && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                {project}
              </p>
            )}
            <div className="space-y-1.5">
              {tasks.map((t, i) => (
                <div key={i} className="bg-muted/40 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground/85">{t.name}</span>
                    <span className="text-xs font-semibold text-indigo-600 tabular-nums">{t.time}</span>
                  </div>
                  {t.descriptions.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/70 italic mt-0.5 truncate">{t.descriptions.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">Total Time</span>
        <span className={`text-lg font-bold tabular-nums ${isStillWorking ? 'text-emerald-600' : 'text-foreground'}`}>{formatDuration(totalHours)}</span>
      </div>
    </div>
  )
}

export function TaskUpdateCard() {
  const { user } = useAuth()
  const { data: attendance, isLoading: attLoading } = useMyAttendance()
  const { data: existingUpdate, isLoading: updateLoading } = useMyTaskUpdate()
  const submitMutation = useSubmitTaskUpdate()
  const isTimerActive = attendance?.status === 'SIGNED_IN'
  useTick(isTimerActive ?? false)

  if (attLoading || updateLoading) {
    return <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex justify-center"><Spinner /></div>
  }

  const pendingData = isPending(existingUpdate) ? existingUpdate : null

  // ═══ Already submitted ═══
  if (existingUpdate && !pendingData && 'updateId' in existingUpdate) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-bold text-emerald-700">Daily Update Submitted</p>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">
            {new Date(existingUpdate.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(existingUpdate.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">{existingUpdate.userName}</span>
            {existingUpdate.employeeId && (
              <span className="text-[10px] font-mono text-muted-foreground/70">{existingUpdate.employeeId}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Sign In</p>
              <p className="text-sm font-semibold text-foreground">{existingUpdate.signIn}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Sign Out</p>
              <p className="text-sm font-semibold text-foreground">{existingUpdate.signOut}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">Task Summary</p>
            <div className="space-y-1.5">
              {existingUpdate.taskSummary.map((t, i) => (
                <div key={i} className="bg-muted/40 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground/85">{i + 1}. {t.taskName}</span>
                    <span className="text-xs font-semibold text-indigo-600">{t.timeRecorded}</span>
                  </div>
                  {t.description && (
                    <p className="text-[11px] text-muted-foreground/70 italic mt-0.5 truncate">{t.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">Total Time</span>
            <span className="text-lg font-bold text-foreground">{existingUpdate.totalTime}</span>
          </div>
        </div>
      </div>
    )
  }

  // ═══ Pending yesterday — show full preview with submit button ═══
  if (pendingData) {
    const pendingAttendance = pendingData.attendance
    const pendingSessions = pendingAttendance?.sessions ?? []
    const hasSessions = pendingSessions.length > 0
    const pendingStillWorking = hasSessions && !pendingSessions[pendingSessions.length - 1].signOutAt

    return (
      <div className="bg-card rounded-2xl border-2 border-amber-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-bold text-amber-700">Pending Daily Update</p>
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg ml-auto">{pendingData.pendingDate}</span>
        </div>

        {hasSessions ? (
          <>
            <SessionPreview sessions={pendingSessions} isTimerActive={pendingStillWorking} />

            {pendingStillWorking && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-3">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[11px] text-amber-700">Stop the timer before submitting</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">
            You have unsubmitted work from <span className="font-semibold">{pendingData.pendingDate}</span>.
          </p>
        )}

        {submitMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Failed to submit'}
          </p>
        )}

        <Button className="w-full mt-3" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}
          disabled={pendingStillWorking}>
          Submit Daily Update for {pendingData.pendingDate}
        </Button>
      </div>
    )
  }

  // ═══ No attendance ═══
  if (!attendance || !attendance.sessions || attendance.sessions.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-dashed border-border/80 p-6 text-center">
        <p className="text-sm text-muted-foreground/70">Start the timer to track your work before submitting a daily update.</p>
      </div>
    )
  }

  // ═══ Preview — ready to submit ═══
  // Sync active session's signInAt with currentSignInAt so times match the LiveTimer
  const sessions = (isTimerActive && attendance.currentSignInAt)
    ? attendance.sessions.map(s => (!s.signOutAt ? { ...s, signInAt: attendance.currentSignInAt! } : s))
    : attendance.sessions
  const isStillWorking = !sessions[sessions.length - 1].signOutAt

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-foreground">Today&apos;s Daily Update</p>
        <span className="text-[10px] text-muted-foreground/70">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">{user?.name || user?.email}</span>
        </div>

        <SessionPreview sessions={sessions} isTimerActive={isTimerActive ?? false} />

        {/* Still working warning */}
        {isStillWorking && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[11px] text-amber-700">Stop the timer before submitting</p>
          </div>
        )}

        {submitMutation.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Failed to submit'}
          </p>
        )}

        <Button className="w-full" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}
          disabled={isStillWorking}>
          Submit Daily Update
        </Button>
      </div>
    </div>
  )
}
