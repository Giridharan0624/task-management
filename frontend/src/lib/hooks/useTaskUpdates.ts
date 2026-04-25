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
 *  server.
 *
 *  Server-side cache: the backend stores one row per (org, week) in
 *  DynamoDB and only invokes Groq on cache miss or when the caller
 *  passes `regenerate=true`. So the React Query cache here is mostly
 *  belt-and-braces — once a week is generated, every subsequent open
 *  is a cheap DDB get. */
export function useWeeklyRollup(weekStart?: string, enabled = true) {
  return useQuery({
    queryKey: keys.weeklyRollup(weekStart),
    queryFn: () => getWeeklyRollup(weekStart),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** Imperative regenerate-and-cache call for the "Regenerate" button.
 *  Bypasses the server-side cache, forces a fresh Groq run, overwrites
 *  the cache, and seeds the React Query cache with the new payload so
 *  the page rerenders without a second round-trip. */
export function useRegenerateWeeklyRollup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (weekStart?: string) => getWeeklyRollup(weekStart, true),
    onSuccess: (data, weekStart) => {
      queryClient.setQueryData(keys.weeklyRollup(weekStart), data)
    },
  })
}
