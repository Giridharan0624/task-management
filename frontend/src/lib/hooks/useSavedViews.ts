'use client'

import { useCallback, useEffect, useState } from 'react'

export interface SavedView {
  id: string
  name: string
  /** URL-serializable filter snapshot. Keys missing from the URL at save
   *  time are intentionally omitted so restoring a view only touches the
   *  fields the user intended. */
  params: Record<string, string>
  createdAt: number
}

const STORAGE_PREFIX = 'tf:saved-views:'

function storageKey(namespace: string, userId: string | undefined): string {
  // User-scoped so saved views don't leak between accounts on the same
  // browser (e.g. shared laptop, QA swaps). Falls back to a global bucket
  // when no user is signed in — irrelevant here since these only render
  // inside authenticated pages, but cheap insurance.
  const u = userId || 'anon'
  return `${STORAGE_PREFIX}${namespace}:${u}`
}

function readViews(key: string): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedView[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v) =>
        v &&
        typeof v.id === 'string' &&
        typeof v.name === 'string' &&
        v.params &&
        typeof v.params === 'object'
    )
  } catch {
    return []
  }
}

function writeViews(key: string, views: SavedView[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(views))
  } catch {
    // Storage full / disabled — fail quiet.
  }
}

interface UseSavedViewsApi {
  views: SavedView[]
  save: (name: string, params: Record<string, string>) => SavedView
  remove: (id: string) => void
  rename: (id: string, name: string) => void
}

/**
 * localStorage-backed list of saved filter snapshots for a given page.
 * Use with useUrlParam / useUrlState — the caller is responsible for
 * serializing current filters on save and applying them via router on
 * click (this hook only does CRUD).
 *
 * Keyed per (namespace, userId). Safe to call with userId=undefined; it
 * just buckets into an 'anon' slot until the user logs in.
 */
export function useSavedViews(
  namespace: string,
  userId: string | undefined
): UseSavedViewsApi {
  const key = storageKey(namespace, userId)
  const [views, setViews] = useState<SavedView[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate client-side only so server/client initial render matches.
  useEffect(() => {
    setViews(readViews(key))
    setHydrated(true)
  }, [key])

  // Persist on every change — but only after the initial hydration pass,
  // otherwise the empty default would clobber stored state on mount.
  useEffect(() => {
    if (!hydrated) return
    writeViews(key, views)
  }, [key, views, hydrated])

  const save = useCallback(
    (name: string, params: Record<string, string>): SavedView => {
      const view: SavedView = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        params,
        createdAt: Date.now(),
      }
      setViews((prev) => [...prev, view])
      return view
    },
    []
  )

  const remove = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name: name.trim() } : v))
    )
  }, [])

  return { views, save, remove, rename }
}

/**
 * Pure comparison helper — returns true when two parameter bags would
 * produce the same URL. Used to flag an "active" saved view when the
 * current URL matches one. Treats missing-keys and empty-string-values
 * as equal since useUrlParam strips defaults from the URL.
 */
export function paramsMatch(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const av = a[k] ?? ''
    const bv = b[k] ?? ''
    if (av !== bv) return false
  }
  return true
}
