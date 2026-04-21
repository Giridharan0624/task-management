'use client'

import { useCallback, useMemo, useState } from 'react'

export interface MultiSelectApi<T extends string> {
  selected: Set<T>
  isSelected: (id: T) => boolean
  toggle: (id: T) => void
  selectAll: (ids: T[]) => void
  clear: () => void
  count: number
  isAllSelected: (ids: T[]) => boolean
  isSomeSelected: (ids: T[]) => boolean
}

/**
 * Tracks a set of selected ids for list/table pages. Typed so callers get
 * autocomplete on the id union. `selectAll` is a toggle — selects every
 * id in the visible set, or clears if all are already selected.
 */
export function useMultiSelect<T extends string = string>(): MultiSelectApi<T> {
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const isSelected = useCallback(
    (id: T) => selected.has(id),
    [selected]
  )

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: T[]) => {
    setSelected((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allOn) {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      }
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isAllSelected = useCallback(
    (ids: T[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected]
  )

  const isSomeSelected = useCallback(
    (ids: T[]) => ids.some((id) => selected.has(id)),
    [selected]
  )

  return useMemo(
    () => ({
      selected,
      isSelected,
      toggle,
      selectAll,
      clear,
      count: selected.size,
      isAllSelected,
      isSomeSelected,
    }),
    [selected, isSelected, toggle, selectAll, clear, isAllSelected, isSomeSelected]
  )
}
