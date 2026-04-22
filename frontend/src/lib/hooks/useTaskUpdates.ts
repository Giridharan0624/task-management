import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  submitTaskUpdate,
  getTaskUpdates,
  getMyTaskUpdate,
  getWeeklyRollup,
} from '@/lib/api/taskUpdateApi'

const keys = {
  all: ['task-updates'] as const,
  byDate: (date: string) => ['task-updates', date] as const,
  my: ['task-updates', 'me'] as const,
  weeklyRollup: (weekStart?: string) =>
    ['task-updates', 'weekly-rollup', weekStart ?? 'current'] as const,
}

export function useTaskUpdates(date?: string) {
  return useQuery({
    queryKey: date ? keys.byDate(date) : keys.all,
    queryFn: () => getTaskUpdates(date),
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useMyTaskUpdate() {
  return useQuery({
    queryKey: keys.my,
    queryFn: getMyTaskUpdate,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useSubmitTaskUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitTaskUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.my })
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })
}

/** Owner/admin AI-assisted weekly digest. `weekStart` is an optional
 *  YYYY-MM-DD; any date inside a week resolves to that Monday on the
 *  server. The rollup is relatively expensive (DynamoDB range-query +
 *  Groq call) so we cache aggressively — 5 minutes — and let the user
 *  trigger manual refetches from the page. */
export function useWeeklyRollup(weekStart?: string, enabled = true) {
  return useQuery({
    queryKey: keys.weeklyRollup(weekStart),
    queryFn: () => getWeeklyRollup(weekStart),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
