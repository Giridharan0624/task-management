'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tf:user-timezone'
const EVENT_NAME = 'tf:timezone-change'

/** Fallback when the browser refuses to report a timezone (very old envs). */
const FALLBACK_TZ = 'UTC'

/** Browser-detected timezone. Runs once per call — cheap, but don't spam it. */
export function detectBrowserTimezone(): string {
  if (typeof Intl === 'undefined') return FALLBACK_TZ
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ
  } catch {
    return FALLBACK_TZ
  }
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(tz: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (tz) window.localStorage.setItem(STORAGE_KEY, tz)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

/**
 * Reads the user's preferred timezone.
 *
 * Priority:
 *   1. Explicit override from localStorage (set via profile page).
 *   2. Browser-detected `Intl` zone.
 *   3. UTC as a last resort.
 *
 * Returns both the resolved zone and a setter. The setter broadcasts a
 * window event so any other mounted consumer re-reads without needing a
 * React Context.
 */
export function useUserTimezone(): {
  timezone: string
  stored: string | null
  setTimezone: (tz: string | null) => void
} {
  const [stored, setStored] = useState<string | null>(null)
  const [browserTz] = useState<string>(() => detectBrowserTimezone())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setStored(readStored())
    setMounted(true)
  }, [])

  // Cross-instance sync without Context: listen for our change event and
  // for the native `storage` event (other tabs).
  useEffect(() => {
    const handler = () => setStored(readStored())
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  const setTimezone = useCallback((tz: string | null) => {
    writeStored(tz)
    setStored(tz)
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME))
    } catch {
      // Ignore.
    }
  }, [])

  const timezone = mounted
    ? stored ?? browserTz
    : // Pre-mount: render with browser default. The server side can't read
      // localStorage anyway, so this keeps SSR/CSR stable.
      browserTz

  return { timezone, stored, setTimezone }
}

/**
 * A curated short-list of timezones for the profile picker. Covers the
 * common customer zones without dumping all ~400 IANA names on the user.
 * Picker is freeform-enabled elsewhere for anything outside this list.
 */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Pacific · Los Angeles' },
  { value: 'America/Denver', label: 'Mountain · Denver' },
  { value: 'America/Chicago', label: 'Central · Chicago' },
  { value: 'America/New_York', label: 'Eastern · New York' },
  { value: 'America/Sao_Paulo', label: 'Brazil · São Paulo' },
  { value: 'Europe/London', label: 'UK · London' },
  { value: 'Europe/Berlin', label: 'Central Europe · Berlin' },
  { value: 'Europe/Athens', label: 'Eastern Europe · Athens' },
  { value: 'Africa/Cairo', label: 'Egypt · Cairo' },
  { value: 'Asia/Dubai', label: 'Gulf · Dubai' },
  { value: 'Asia/Kolkata', label: 'India · Kolkata' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Shanghai', label: 'China · Shanghai' },
  { value: 'Asia/Tokyo', label: 'Japan · Tokyo' },
  { value: 'Australia/Sydney', label: 'Australia · Sydney' },
]
