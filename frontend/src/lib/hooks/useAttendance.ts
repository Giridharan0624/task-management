import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMyAttendance,
  getTodayAttendance,
  getAttendanceReport,
  signInToWork,
  signOutFromWork,
} from '@/lib/api/attendanceApi'

const attendanceKeys = {
  me: ['attendance', 'me'] as const,
  today: ['attendance', 'today'] as const,
  report: (start: string, end: string) => ['attendance', 'report', start, end] as const,
}

export function useMyAttendance() {
  return useQuery({
    queryKey: attendanceKeys.me,
    queryFn: getMyAttendance,
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
  })
}

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signInToWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.me })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today })
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signOutFromWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.me })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today })
    },
  })
}
