'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'

/**
 * Small client-only side-effect that redirects an already-authed visitor
 * to /dashboard. Returns nothing — the landing page stays in the DOM until
 * the redirect fires (~one paint). Renders no spinner intentionally: the
 * landing content itself is the loading state for crawlers and new visitors.
 */
export function MaybeRedirectIfAuthed() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (user) router.replace('/dashboard')
  }, [user, isLoading, router])

  return null
}
