'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CognitoUser } from 'amazon-cognito-identity-js'
import type { User } from '@/types/user'
import {
  signIn as cognitoSignIn,
  completeNewPassword as cognitoCompleteNewPassword,
  completeMfaChallenge as cognitoCompleteMfaChallenge,
  signOut as cognitoSignOut,
  changePassword as cognitoChangePassword,
  refreshSession as cognitoRefreshSession,
  getCurrentToken,
} from './cognitoClient'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface PendingPasswordChange {
  cognitoUser: CognitoUser
  userAttributes: Record<string, string>
}

interface PendingMfaChallenge {
  cognitoUser: CognitoUser
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  needsPasswordChange: boolean
  /** True while sign-in is paused on a TOTP MFA challenge. The
   *  LoginForm flips to a 6-digit code input while this is set. */
  needsMfaChallenge: boolean
  signIn: (email: string, password: string) => Promise<void>
  completePasswordChange: (newPassword: string) => Promise<void>
  /** Submit the authenticator code to finish sign-in when the user
   *  has TOTP MFA enabled. */
  completeMfaChallenge: (code: string) => Promise<void>
  signOut: () => void
  updateUser: (updates: Partial<User>) => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  /** Force-refresh the ID token + update local state. Call after any
   * server action that may have changed the user's role or claims
   * (e.g. after an admin edits a role the current user holds). */
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeJwtForUser(token: string): User | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const decoded = JSON.parse(jsonPayload) as Record<string, unknown>
    // `email_verified` is a standard OIDC claim Cognito emits as a bool
    // (true) or missing (legacy users). A missing claim is treated as
    // verified — pre-rollout users had the admin-create path stamp
    // the attribute true at creation time, and we don't want to
    // retroactively lock them out of the dashboard.
    const rawVerified = decoded.email_verified
    const emailVerified =
      rawVerified === undefined
        ? true
        : rawVerified === true || rawVerified === 'true'
    return {
      userId: decoded.sub as string,
      employeeId: (decoded['custom:employeeId'] as string) ?? undefined,
      email: decoded.email as string,
      name: (decoded.name as string) ?? (decoded.email as string),
      systemRole: ((decoded['custom:systemRole'] as string) ?? 'MEMBER') as User['systemRole'],
      emailVerified,
      createdAt: '',
      updatedAt: '',
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingPasswordChange, setPendingPasswordChange] = useState<PendingPasswordChange | null>(null)
  const [pendingMfaChallenge, setPendingMfaChallenge] = useState<PendingMfaChallenge | null>(null)

  // Pull tenant.refreshCurrent() up here so signIn can call it after the
  // token is stored. Without this, the dashboard renders before
  // /orgs/current returns and the user sees no tenant branding /
  // terminology / features until they manually reload.
  const { refreshCurrent: refreshTenant, clearWorkspace } = useTenant()

  const needsPasswordChange = pendingPasswordChange !== null
  const needsMfaChallenge = pendingMfaChallenge !== null

  // Check token on load
  useEffect(() => {
    const storedToken = getCurrentToken()
    if (storedToken) {
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]))
        const expiry = payload.exp * 1000
        if (Date.now() >= expiry) {
          localStorage.removeItem('auth_token')
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.replace('/login')
          }
          setIsLoading(false)
          return
        }
      } catch {
        localStorage.removeItem('auth_token')
        setIsLoading(false)
        return
      }

      setToken(storedToken)
      const decoded = decodeJwtForUser(storedToken)
      setUser(decoded)
      // Hydrate tenant settings (font, theme, terminology, features,
      // leave types) on every page load — not just after login. Without
      // this, a hard-refresh would flash the default font/colors until
      // some other page-level hook happened to fetch /orgs/current.
      // Best-effort: if the call fails, dashboard hooks will retry on
      // their own.
      void refreshTenant()
    }
    setIsLoading(false)
    // refreshTenant is stable (useCallback in TenantProvider); excluded
    // from deps so this effect runs once per mount, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Periodic token expiry check — every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const t = getCurrentToken()
      if (!t) return
      try {
        const payload = JSON.parse(atob(t.split('.')[1]))
        if (Date.now() >= payload.exp * 1000) {
          localStorage.removeItem('auth_token')
          setToken(null)
          setUser(null)
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.replace('/login')
          }
        }
      } catch { /* ignore */ }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const signIn = useCallback(async (identifier: string, password: string) => {
    let loginEmail = identifier.trim()

    // If it looks like an employee ID, resolve to email first
    if (/^(EMP-\d+|[A-Z]{2,4}-[A-Z]{3}-\d{2}[A-Z0-9]+|[A-Z]{2,4}-[A-Z0-9]+)$/i.test(loginEmail) && !loginEmail.includes('@')) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/resolve-employee?employeeId=${loginEmail}`)
      if (!res.ok) throw new Error('Employee ID not found')
      const data = await res.json()
      loginEmail = data.email
    }

    const result = await cognitoSignIn(loginEmail, password)

    if (result.type === 'NEW_PASSWORD_REQUIRED') {
      // User needs to set a new password — don't set tokens yet
      setPendingPasswordChange({
        cognitoUser: result.cognitoUser,
        userAttributes: result.userAttributes,
      })
      return
    }

    if (result.type === 'SOFTWARE_TOKEN_MFA') {
      // TOTP enrolled — pause the login flow and let the form
      // collect the authenticator code. `completeMfaChallenge` below
      // finishes the sign-in with the collected code.
      setPendingMfaChallenge({ cognitoUser: result.cognitoUser })
      return
    }

    // Normal success
    const idToken = result.tokens.idToken
    localStorage.setItem('auth_token', idToken)
    setToken(idToken)
    setUser(decodeJwtForUser(idToken))
    // Hydrate the full org payload (settings + plan + branding) before
    // the dashboard renders. Best-effort — if /orgs/current 401s
    // because of a token race, the dashboard's own hooks will retry.
    try {
      await refreshTenant()
    } catch {
      // ignore — TenantProvider's effect will fall back to /orgs/by-slug
    }
  }, [refreshTenant])

  const completeMfaChallenge = useCallback(async (code: string) => {
    if (!pendingMfaChallenge) throw new Error('No pending MFA challenge')
    const tokens = await cognitoCompleteMfaChallenge(
      pendingMfaChallenge.cognitoUser,
      code.trim(),
    )
    const idToken = tokens.idToken
    localStorage.setItem('auth_token', idToken)
    setToken(idToken)
    setUser(decodeJwtForUser(idToken))
    setPendingMfaChallenge(null)
    try {
      await refreshTenant()
    } catch {
      // ignore — TenantProvider falls back to public branding
    }
  }, [pendingMfaChallenge, refreshTenant])

  const completePasswordChange = useCallback(async (newPassword: string) => {
    if (!pendingPasswordChange) throw new Error('No pending password change')

    const tokens = await cognitoCompleteNewPassword(
      pendingPasswordChange.cognitoUser,
      newPassword,
      pendingPasswordChange.userAttributes,
    )

    const idToken = tokens.idToken
    localStorage.setItem('auth_token', idToken)
    setToken(idToken)
    setUser(decodeJwtForUser(idToken))
    setPendingPasswordChange(null)
    try {
      await refreshTenant()
    } catch {
      // ignore — TenantProvider falls back to public branding
    }
  }, [pendingPasswordChange, refreshTenant])

  const signOut = useCallback(() => {
    cognitoSignOut()
    setToken(null)
    setUser(null)
    setPendingPasswordChange(null)
    setPendingMfaChallenge(null)
    // Drop the cached workspace slug too — a second user on the same
    // device should not see the previous user's org branding on the
    // login screen.
    clearWorkspace()
  }, [clearWorkspace])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null)
  }, [])

  const changePasswordFn = useCallback(async (oldPassword: string, newPassword: string) => {
    await cognitoChangePassword(oldPassword, newPassword)
  }, [])

  const refreshSession = useCallback(async () => {
    // Force a fresh ID token and re-hydrate local user state from the
    // new claims — picks up role / orgId changes that happened since
    // the last login.
    const freshToken = await cognitoRefreshSession()
    setToken(freshToken)
    const decoded = decodeJwtForUser(freshToken)
    if (decoded) setUser(decoded)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      needsPasswordChange, needsMfaChallenge,
      signIn, completePasswordChange, completeMfaChallenge,
      signOut, updateUser,
      changePassword: changePasswordFn,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
