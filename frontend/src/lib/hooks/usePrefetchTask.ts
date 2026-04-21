'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getComments } from '@/lib/api/commentApi'

/**
 * Returns an event handler that warms the comments cache for a task. Most
 * other data shown in the task detail panel (users, project members, the
 * task itself) is already cached from the list view, so comments are the
 * single biggest win for perceived open-speed.
 *
 * Attach to `onMouseEnter` / `onFocus` on task rows/cards.
 */
export function usePrefetchTask() {
  const queryClient = useQueryClient()

  return useCallback(
    (projectId: string, taskId: string) => {
      if (!projectId || !taskId) return
      queryClient.prefetchQuery({
        queryKey: ['comments', taskId],
        queryFn: () => getComments(projectId, taskId),
        staleTime: 15_000,
      })
    },
    [queryClient]
  )
}
