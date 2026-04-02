'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CognitoUser } from 'amazon-cognito-identity-js'
import type { User } from '@/types/user'
import {
  signIn as cognitoSignIn,
  completeNewPassword as cognitoCompleteNewPassword,
  signOut as cognitoSignOut,
  changePassword as cognitoChangePassword,
  getCurrentToken,
} from './cognitoClient'

interface PendingPasswordChange {
  cognitoUser: CognitoUser
  userAttributes: Record<string, string>
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  needsPasswordChange: boolean
  signIn: (email: string, password: string) => Promise<void>
  completePasswordChange: (newPassword: string) => Promise<void>
  signOut: () => void
  updateUser: (updates: Partial<User>) => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
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
    return {
      userId: decoded.sub as string,
      employeeId: (decoded['custom:employeeId'] as string) ?? undefined,
      email: decoded.email as string,
      name: (decoded.name as string) ?? (decoded.email as string),
      systemRole: ((decoded['custom:systemRole'] as string) ?? 'MEMBER') as User['systemRole'],
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

  const needsPasswordChange = pendingPasswordChange !== null

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
    }
    setIsLoading(false)
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

    // Normal success
    const idToken = result.tokens.idToken
    localStorage.setItem('auth_token', idToken)
    setToken(idToken)
    setUser(decodeJwtForUser(idToken))
  }, [])

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
  }, [pendingPasswordChange])

  const signOut = useCallback(() => {
    cognitoSignOut()
    setToken(null)
    setUser(null)
    setPendingPasswordChange(null)
  }, [])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null)
  }, [])

  const changePasswordFn = useCallback(async (oldPassword: string, newPassword: string) => {
    await cognitoChangePassword(oldPassword, newPassword)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, needsPasswordChange,
      signIn, completePasswordChange, signOut, updateUser,
      changePassword: changePasswordFn,
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
