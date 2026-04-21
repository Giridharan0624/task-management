'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

type Primitive = string | number | boolean | null | undefined

/**
 * Reads a single query-string param with a fallback default. Returns a setter
 * that patches the URL without scrolling. Empty / default values are stripped
 * from the URL to keep it clean and shareable.
 *
 * Usage:
 *   const [search, setSearch] = useUrlParam('q', '')
 *   const [view, setView] = useUrlParam<'list' | 'board'>('view', 'list')
 */
export function useUrlParam<T extends Primitive>(
  key: string,
  defaultValue: T
): [T, (next: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const value = useMemo<T>(() => {
    const raw = sp.get(key)
    if (raw == null) return defaultValue
    if (typeof defaultValue === 'number') {
      const n = Number(raw)
      return (Number.isNaN(n) ? defaultValue : (n as unknown)) as T
    }
    if (typeof defaultValue === 'boolean') {
      return (raw === '1' || raw === 'true') as unknown as T
    }
    return raw as unknown as T
  }, [sp, key, defaultValue])

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(sp.toString())
      const isDefault =
        next === defaultValue ||
        next === '' ||
        next == null ||
        next === false
      if (isDefault) {
        params.delete(key)
      } else if (typeof next === 'boolean') {
        params.set(key, next ? '1' : '0')
      } else {
        params.set(key, String(next))
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [sp, router, pathname, key, defaultValue]
  )

  return [value, setValue]
}

/**
 * Reads many query params as a single object with defaults, and patches them
 * atomically. Use for toolbar filter bundles (search/sort/priority/etc) so
 * each toolbar change produces one history entry.
 *
 * Usage:
 *   const [filters, patchFilters] = useUrlState({
 *     search: '',
 *     sort: 'default',
 *     priority: 'ALL',
 *     overdueOnly: false,
 *   })
 *   patchFilters({ priority: 'HIGH' })
 */
export function useUrlState<T extends object>(
  defaults: T
): [T, (patch: Partial<T>) => void, () => void] {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const defaultsRec = defaults as Record<string, Primitive>

  const state = useMemo<T>(() => {
    const out: Record<string, Primitive> = { ...defaultsRec }
    for (const key of Object.keys(defaultsRec)) {
      const raw = sp.get(key)
      if (raw == null) continue
      const def = defaultsRec[key]
      if (typeof def === 'number') {
        const n = Number(raw)
        out[key] = Number.isNaN(n) ? def : n
      } else if (typeof def === 'boolean') {
        out[key] = raw === '1' || raw === 'true'
      } else {
        out[key] = raw
      }
    }
    return out as T
  }, [sp, defaultsRec])

  const patch = useCallback(
    (next: Partial<T>) => {
      const params = new URLSearchParams(sp.toString())
      for (const [key, val] of Object.entries(next as Record<string, Primitive>)) {
        const def = defaultsRec[key]
        const isDefault =
          val === def || val === '' || val == null || val === false
        if (isDefault) {
          params.delete(key)
        } else if (typeof val === 'boolean') {
          params.set(key, val ? '1' : '0')
        } else {
          params.set(key, String(val))
        }
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [sp, router, pathname, defaultsRec]
  )

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return [state, patch, reset]
}
