import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submitTaskUpdate, getTaskUpdates, getMyTaskUpdate } from '@/lib/api/taskUpdateApi'

const keys = {
  all: ['task-updates'] as const,
  byDate: (date: string) => ['task-updates', date] as const,
  my: ['task-updates', 'me'] as const,
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
