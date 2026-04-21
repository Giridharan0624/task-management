'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getProject, getProjectStatus } from '@/lib/api/projectApi'
import { projectKeys } from './useProjects'

/**
 * Returns an event handler that warms the React Query cache for a project's
 * detail + status. Attach to `onMouseEnter` / `onFocus` on project cards so
 * the detail page opens from cache on click.
 */
export function usePrefetchProject() {
  const queryClient = useQueryClient()

  return useCallback(
    (projectId: string) => {
      if (!projectId) return
      // React Query de-dupes — calling prefetchQuery twice for the same key
      // while a request is in flight is a no-op.
      queryClient.prefetchQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: () => getProject(projectId),
        staleTime: 30_000,
      })
      queryClient.prefetchQuery({
        queryKey: projectKeys.status(projectId),
        queryFn: () => getProjectStatus(projectId),
        staleTime: 30_000,
      })
    },
    [queryClient]
  )
}
