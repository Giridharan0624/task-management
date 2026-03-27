'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@/types/user'
import {
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  getCurrentToken,
  getCurrentUser,
} from './cognitoClient'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  updateUser: (updates: Partial<User>) => void
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

  useEffect(() => {
    const storedToken = getCurrentToken()
    if (storedToken) {
      setToken(storedToken)
      const decoded = decodeJwtForUser(storedToken)
      setUser(decoded)
    }
    setIsLoading(false)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await cognitoSignIn(email, password)
    const idToken = tokens.idToken
    localStorage.setItem('auth_token', idToken)
    setToken(idToken)
    const decoded = decodeJwtForUser(idToken)
    setUser(decoded)
  }, [])

  const signOut = useCallback(() => {
    cognitoSignOut()
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, updateUser }}>
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
