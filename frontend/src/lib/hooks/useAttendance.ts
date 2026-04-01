import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMyAttendance,
  getTodayAttendance,
  getAttendanceReport,
  signInToWork,
  signOutFromWork,
} from '@/lib/api/attendanceApi'
import type { Attendance, StartTimerData } from '@/types/attendance'

const attendanceKeys = {
  me: ['attendance', 'me'] as const,
  today: ['attendance', 'today'] as const,
  report: (start: string, end: string) => ['attendance', 'report', start, end] as const,
}

export function useMyAttendance() {
  return useQuery({
    queryKey: attendanceKeys.me,
    queryFn: async () => {
      const data = await getMyAttendance()
      // If we have an optimistic sign-in timestamp, preserve it so the timer
      // doesn't jump when the background refetch returns the server timestamp
      if (_optimisticSignInAt && data && data.status === 'SIGNED_IN') {
        let patched = { ...data, currentSignInAt: _optimisticSignInAt }
        if (patched.sessions && patched.sessions.length > 0) {
          const lastIdx = patched.sessions.length - 1
          const last = patched.sessions[lastIdx]
          if (!last.signOutAt) {
            patched = { ...patched, sessions: [...patched.sessions.slice(0, lastIdx), { ...last, signInAt: _optimisticSignInAt }] }
          }
        }
        return patched
      }
      return data
    },
    staleTime: 15000,
    refetchInterval: 15000,
  })
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: attendanceKeys.today,
    queryFn: getTodayAttendance,
    staleTime: 10000,
    refetchInterval: 10000,
  })
}

export function useAttendanceReport(startDate: string, endDate: string) {
  return useQuery({
    queryKey: attendanceKeys.report(startDate, endDate),
    queryFn: () => getAttendanceReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

// Stores the client-side sign-in timestamp so the timer never jumps
let _optimisticSignInAt: string | null = null

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data?: StartTimerData) => signInToWork(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: attendanceKeys.me })
      const previous = queryClient.getQueryData<Attendance | null>(attendanceKeys.me)

      // Record the exact client timestamp — this is what the timer uses
      const now = new Date().toISOString()
      _optimisticSignInAt = now

      // Close the previous active session (if switching tasks)
      let existingSessions = [...(previous?.sessions ?? [])]
      if (existingSessions.length > 0) {
        const lastIdx = existingSessions.length - 1
        const last = existingSessions[lastIdx]
        if (!last.signOutAt) {
          const elapsed = Math.max(0, (Date.now() - new Date(last.signInAt).getTime()) / 3600000)
          existingSessions = [
            ...existingSessions.slice(0, lastIdx),
            { ...last, signOutAt: now, hours: elapsed },
          ]
        }
      }

      const optimistic: Partial<Attendance> = {
        ...previous,
        status: 'SIGNED_IN',
        currentSignInAt: now,
        currentTask: data ? {
          taskId: data.taskId,
          projectId: data.projectId,
          taskTitle: data.taskTitle,
          projectName: data.projectName,
        } : previous?.currentTask ?? null,
        sessions: [
          ...existingSessions,
          { signInAt: now, signOutAt: null, hours: null, taskId: data?.taskId ?? null, projectId: data?.projectId ?? null, taskTitle: data?.taskTitle ?? null, projectName: data?.projectName ?? null, description: data?.description ?? null },
        ],
      }
      queryClient.setQueryData(attendanceKeys.me, optimistic)
      return { previous }
    },
    onSuccess: (data) => {
      if (data) {
        // Keep the client-side timestamp so the timer doesn't jump
        if (_optimisticSignInAt && data.status === 'SIGNED_IN') {
          data = { ...data, currentSignInAt: _optimisticSignInAt }
          // Also fix the last session's signInAt so getSessionHours works
          if (data.sessions && data.sessions.length > 0) {
            const lastIdx = data.sessions.length - 1
            const lastSession = data.sessions[lastIdx]
            if (!lastSession.signOutAt) {
              data = {
                ...data,
                sessions: [
                  ...data.sessions.slice(0, lastIdx),
                  { ...lastSession, signInAt: _optimisticSignInAt },
                ],
              }
            }
          }
        }
        queryClient.setQueryData(attendanceKeys.me, data)
      }
      // Do NOT clear _optimisticSignInAt here — keep it alive so refetches
      // (window focus, 60s interval) continue patching with the client timestamp.
      // It gets cleared only on sign-out or error.
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today })
    },
    onError: (_err, _vars, context) => {
      _optimisticSignInAt = null
      if (context?.previous !== undefined) {
        queryClient.setQueryData(attendanceKeys.me, context.previous)
      }
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signOutFromWork,
    onMutate: async () => {
      // Clear optimistic sign-in timestamp — we're stopping
      _optimisticSignInAt = null
      await queryClient.cancelQueries({ queryKey: attendanceKeys.me })
      const previous = queryClient.getQueryData<Attendance | null>(attendanceKeys.me)

      // Optimistically mark as signed out — also close the last session
      if (previous) {
        const now = new Date().toISOString()
        let patchedSessions = previous.sessions ?? []
        if (patchedSessions.length > 0) {
          const lastIdx = patchedSessions.length - 1
          const last = patchedSessions[lastIdx]
          if (!last.signOutAt) {
            const elapsed = Math.max(0, (Date.now() - new Date(last.signInAt).getTime()) / 3600000)
            patchedSessions = [
              ...patchedSessions.slice(0, lastIdx),
              { ...last, signOutAt: now, hours: elapsed },
            ]
          }
        }
        queryClient.setQueryData(attendanceKeys.me, {
          ...previous,
          status: 'SIGNED_OUT',
          currentSignInAt: null,
          currentTask: null,
          sessions: patchedSessions,
          totalHours: patchedSessions.reduce((s, se) => s + (se.hours ?? 0), 0),
        })
      }
      return { previous }
    },
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(attendanceKeys.me, data)
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today })
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(attendanceKeys.me, context.previous)
      }
    },
  })
}
