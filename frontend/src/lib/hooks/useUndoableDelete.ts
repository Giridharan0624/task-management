'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'

interface UndoableDeleteOptions<T extends { [K in IdKey]: string }, IdKey extends keyof T> {
  /**
   * Query key holding the list to mutate (e.g. ['my-tasks'] or ['projects']).
   * The cache entry must be an array of T.
   */
  queryKey: QueryKey
  /** Property name on the item that is the unique id. */
  idKey: IdKey
  /** Fire the real DELETE request. Called after the undo window expires. */
  commit: (id: string) => Promise<unknown>
  /** Optional extra query keys to invalidate after commit (or on undo). */
  invalidate?: QueryKey[]
  /** How long the undo window stays open. Default 5s. */
  delayMs?: number
  /** Toast label. Default: `<entityLabel> deleted`. */
  toastMessage?: string
  /** Displayed in default toast message — e.g. 'Task'. */
  entityLabel?: string
}

/**
 * Deletes an item with a client-side undo window:
 *   1. Optimistically removes the item from the list cache.
 *   2. Shows an "Undo" toast.
 *   3. Fires the actual DELETE request after `delayMs` unless the user clicks Undo.
 *   4. If the caller unmounts mid-window, the pending delete still fires so
 *      we don't silently revive the item.
 */
export function useUndoableDelete<
  T extends { [K in IdKey]: string },
  IdKey extends keyof T,
>(options: UndoableDeleteOptions<T, IdKey>) {
  const {
    queryKey,
    idKey,
    commit,
    invalidate = [],
    delayMs = 5000,
    toastMessage,
    entityLabel = 'Item',
  } = options

  const queryClient = useQueryClient()
  const toast = useToast()
  const pendingRef = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; item: T; toastId: string }>
  >(new Map())

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey })
    for (const k of invalidate) queryClient.invalidateQueries({ queryKey: k })
  }

  // Commit any still-pending deletes if the caller unmounts. Without this, a
  // user who deletes then navigates would see the item rematerialize on return.
  useEffect(() => {
    const map = pendingRef.current
    return () => {
      for (const { timer, item } of map.values()) {
        clearTimeout(timer)
        const id = String(item[idKey])
        commit(id).catch(() => {
          // Swallow: the UI has already moved on. React Query will
          // repopulate with real state on next refetch.
        })
      }
      map.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = (item: T) => {
    const id = String(item[idKey])

    // Optimistically drop it from the list
    const previous = queryClient.getQueryData<T[]>(queryKey)
    queryClient.setQueryData<T[]>(queryKey, (old) =>
      old ? old.filter((x) => String(x[idKey]) !== id) : old
    )

    // Schedule the real delete
    const timer = setTimeout(() => {
      const entry = pendingRef.current.get(id)
      if (!entry) return
      pendingRef.current.delete(id)
      commit(id)
        .catch((err) => {
          // Restore on server failure
          if (previous) queryClient.setQueryData(queryKey, previous)
          invalidateAll()
          toast.error(
            err instanceof Error ? err.message : `Failed to delete ${entityLabel.toLowerCase()}`
          )
        })
        .finally(() => invalidateAll())
    }, delayMs)

    const toastId = toast.undoable(
      toastMessage ?? `${entityLabel} deleted`,
      () => {
        const entry = pendingRef.current.get(id)
        if (entry) {
          clearTimeout(entry.timer)
          pendingRef.current.delete(id)
        }
        if (previous) queryClient.setQueryData(queryKey, previous)
        invalidateAll()
      },
      { duration: delayMs }
    )

    pendingRef.current.set(id, { timer, item, toastId })
  }

  return remove
}
