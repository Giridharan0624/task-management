import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyActivity, getActivityReport, generateSummary, getSummary } from '@/lib/api/activityApi'

export function useMyActivity(date?: string) {
  return useQuery({
    queryKey: ['activity', 'me', date],
    queryFn: () => getMyActivity(date),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useActivityReport(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['activity', 'report', startDate, endDate],
    queryFn: () => getActivityReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useSummary(userId: string, date: string) {
  return useQuery({
    queryKey: ['activity', 'summary', userId, date],
    queryFn: () => getSummary(userId, date),
    enabled: !!userId && !!date,
    staleTime: 60_000,
  })
}

export function useGenerateSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, date, taskContext }: { userId: string; date: string; taskContext?: string }) =>
      generateSummary(userId, date, taskContext),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['activity', 'summary', data.userId, data.date] })
    },
  })
}
