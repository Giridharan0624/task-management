'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { orgsApi } from '@/lib/api/orgsApi'
import { applyTenantTheme } from '@/lib/tenant/theme'
import type { CurrentOrgResponse, OrgSummary } from '@/types/org'

const STORAGE_KEY = 'taskflow_workspace'

interface TenantContextValue {
  /** The active workspace code, or '' when unknown.
   *
   *  Login is email+password only — the workspace is never part of the
   *  credential. The slug is resolved *after* login from the JWT's org
   *  claim (via refreshCurrent()). Pre-login the slug is almost always
   *  empty, which renders a generic TaskFlow login screen with no
   *  tenant theming. Returning users get pre-themed on subsequent
   *  visits via the slug that was cached in localStorage after their
   *  previous session. */
  slug: string
  /** Public branding data from GET /orgs/by-slug/{slug}. Null
   *  whenever slug is empty — we don't fetch without an explicit
   *  workspace code. */
  summary: OrgSummary | null
  /** Full org + settings + plan from GET /orgs/current. Available only
   *  after the user has an authenticated session. Hydrated via
   *  refreshCurrent() — called by AuthProvider after login. */
  current: CurrentOrgResponse | null
  isLoading: boolean
  error: string | null
  setSlug: (slug: string) => void
  clearWorkspace: () => void
  refreshCurrent: () => Promise<void>
}

const TenantContext = createContext<TenantContextValue | null>(null)

/** The slug is only remembered from a previously-authenticated session
 *  via localStorage. Pre-auth theming via `?workspace=` query param has
 *  been retired — first-time visitors see a generic login screen, and
 *  the real tenant is resolved from the JWT once the user is signed in.
 *  Empty string means "no tenant yet". */
function readInitialSlug(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlugState] = useState<string>('')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [current, setCurrent] = useState<CurrentOrgResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve initial slug client-side (URL → localStorage → empty)
  useEffect(() => {
    setSlugState(readInitialSlug())
  }, [])

  // Fetch pre-auth branding only when we actually have a slug. Empty
  // slug means generic login — don't call the API at all.
  useEffect(() => {
    if (!slug) {
      setSummary(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    orgsApi
      .getBySlug(slug)
      .then((s) => {
        if (cancelled) return
        setSummary(s)
        // Apply tenant branding colors ASAP so the login/signup page
        // and the dashboard both theme before first render settles.
        applyTenantTheme(s.primaryColor, s.accentColor)
        setIsLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSummary(null)
        // Bad/stale slug → forget it so we don't keep 404ing. Typical
        // case: user logged out of one org and is signing into another;
        // the old slug sits in localStorage and mismatches their JWT.
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY)
        }
        setSlugState('')
        setError(e instanceof Error ? e.message : 'Workspace not found')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const setSlug = useCallback((newSlug: string) => {
    const normalized = newSlug.trim().toLowerCase()
    setSlugState(normalized)
    if (typeof window !== 'undefined') {
      if (normalized) {
        localStorage.setItem(STORAGE_KEY, normalized)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const clearWorkspace = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    setSlugState('')
    setCurrent(null)
    setSummary(null)
  }, [])

  const refreshCurrent = useCallback(async () => {
    try {
      const c = await orgsApi.getCurrent()
      setCurrent(c)
      // If the logged-in user's org differs from the cached slug
      // (e.g. user switched workspaces), sync it.
      if (c.org.slug && c.org.slug !== slug) {
        setSlug(c.org.slug)
      }
      // Apply the full (authed) branding payload — catches any
      // settings edits made since the public `/orgs/by-slug/{slug}`
      // response was cached.
      if (c.settings) {
        applyTenantTheme(c.settings.primaryColor, c.settings.accentColor)
      }
    } catch {
      // Not logged in yet, or org not found — ignore.
    }
  }, [slug, setSlug])

  // Listen for mid-session suspension events fired by the API client
  // (ORG_SUSPENDED error code). Triggers a refetch so `current.org.status`
  // flips to SUSPENDED and the dashboard layout swaps to SuspendedScreen
  // immediately.
  useEffect(() => {
    const onSuspended = () => {
      void refreshCurrent()
    }
    window.addEventListener('taskflow:org-suspended', onSuspended)
    return () => window.removeEventListener('taskflow:org-suspended', onSuspended)
  }, [refreshCurrent])

  return (
    <TenantContext.Provider
      value={{
        slug,
        summary,
        current,
        isLoading,
        error,
        setSlug,
        clearWorkspace,
        refreshCurrent,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return ctx
}
