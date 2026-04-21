'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAutosaveDraftOptions {
  /** Debounce window before writing to localStorage. Default 400ms. */
  debounceMs?: number
  /**
   * If the draft equals this string (e.g. the empty string or the initial
   * value passed by the parent) don't persist it and clear any existing
   * saved copy. Prevents "empty draft restore" prompts on first render.
   */
  emptyValue?: string
  /** Skip all read/write. Useful to disable drafts on edit-existing forms. */
  enabled?: boolean
}

const STORAGE_PREFIX = 'tf:draft:'
const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`

function readDraft(key: string): { value: string; savedAt: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value: string; savedAt: number }
    if (typeof parsed?.value !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function writeDraft(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      storageKey(key),
      JSON.stringify({ value, savedAt: Date.now() })
    )
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
}

function clearDraft(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // Ignore.
  }
}

/**
 * Persists a string-valued form field to localStorage so users don't lose
 * long-form content when they navigate away, crash, or close the tab.
 *
 * Usage — controlled field:
 *   const [description, setDescription] = useState('')
 *   const draft = useAutosaveDraft('task:description', description)
 *   useEffect(() => {
 *     if (draft.pendingRestore) setDescription(draft.pendingRestore.value)
 *   }, [draft.pendingRestore])
 *   // On successful submit: draft.clear()
 *
 * Usage — react-hook-form:
 *   const { watch, setValue } = useForm(...)
 *   const description = watch('description') ?? ''
 *   const draft = useAutosaveDraft('task:description', description)
 *   if (draft.pendingRestore) { ... show banner, call setValue('description', v) ... }
 */
export function useAutosaveDraft(
  key: string,
  value: string,
  options: UseAutosaveDraftOptions = {}
) {
  const { debounceMs = 400, emptyValue = '', enabled = true } = options

  // Read once on mount so the parent form can decide whether to offer restore.
  const [pendingRestore, setPendingRestore] = useState<
    { value: string; savedAt: number } | null
  >(() => (enabled ? readDraft(key) : null))

  // Don't auto-save the very first value — otherwise mount overwrites whatever
  // draft is on disk with the initial (empty) value before the user types.
  const didMountRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (value === emptyValue) clearDraft(key)
      else writeDraft(key, value)
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, key, value, emptyValue, debounceMs])

  const clear = useCallback(() => {
    clearDraft(key)
    setPendingRestore(null)
  }, [key])

  const dismissRestore = useCallback(() => {
    clearDraft(key)
    setPendingRestore(null)
  }, [key])

  return { pendingRestore, clear, dismissRestore }
}

/** Drops a draft without reading it first — for imperative callsites. */
export function clearAutosaveDraft(key: string): void {
  clearDraft(key)
}
