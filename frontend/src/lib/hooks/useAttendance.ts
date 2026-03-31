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
        return { ...data, currentSignInAt: _optimisticSignInAt }
      }
      return data
    },
    refetchInterval: 60000,
  })
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: attendanceKeys.today,
    queryFn: getTodayAttendance,
    refetchInterval: 60000,
  })
}

export function useAttendanceReport(startDate: string, endDate: string) {
  return useQuery({
    queryKey: attendanceKeys.report(startDate, endDate),
    queryFn: () => getAttendanceReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
    refetchInterval: 60000,
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
          ...(previous?.sessions ?? []),
          { signInAt: now, signOutAt: null, hours: null, taskId: data?.taskId ?? null, projectId: data?.projectId ?? null, taskTitle: data?.taskTitle ?? null, projectName: data?.projectName ?? null },
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
        }
        queryClient.setQueryData(attendanceKeys.me, data)
      }
      _optimisticSignInAt = null
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
      await queryClient.cancelQueries({ queryKey: attendanceKeys.me })
      const previous = queryClient.getQueryData<Attendance | null>(attendanceKeys.me)

      // Optimistically mark as signed out
      if (previous) {
        queryClient.setQueryData(attendanceKeys.me, {
          ...previous,
          status: 'SIGNED_OUT',
          currentSignInAt: null,
          currentTask: null,
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
