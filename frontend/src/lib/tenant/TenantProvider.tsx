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

const DEFAULT_SLUG = 'neurostack'
const STORAGE_KEY = 'taskflow_workspace'

interface TenantContextValue {
  /** The active workspace code. Resolved once at mount from URL query
   *  `?workspace=...`, then localStorage, then DEFAULT_SLUG. */
  slug: string
  /** Public branding data from GET /orgs/by-slug/{slug}. Available
   *  even before the user logs in so the login screen can theme. */
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

function readInitialSlug(): string {
  if (typeof window === 'undefined') return DEFAULT_SLUG
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('workspace')
  if (fromQuery) {
    const normalized = fromQuery.trim().toLowerCase()
    localStorage.setItem(STORAGE_KEY, normalized)
    return normalized
  }
  const fromStorage = localStorage.getItem(STORAGE_KEY)
  if (fromStorage) return fromStorage
  return DEFAULT_SLUG
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlugState] = useState<string>(DEFAULT_SLUG)
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [current, setCurrent] = useState<CurrentOrgResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve initial slug client-side (URL → localStorage → default)
  useEffect(() => {
    setSlugState(readInitialSlug())
  }, [])

  // Fetch summary whenever slug changes. Public endpoint, safe
  // to call pre-authentication.
  useEffect(() => {
    if (!slug) return
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
      localStorage.setItem(STORAGE_KEY, normalized)
    }
  }, [])

  const clearWorkspace = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    setSlugState(DEFAULT_SLUG)
    setCurrent(null)
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
