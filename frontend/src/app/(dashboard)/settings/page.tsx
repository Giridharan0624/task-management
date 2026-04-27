'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * `/settings` index → redirect to General. The Settings shell
 * (layout.tsx) renders the left-nav; without a child route there's
 * nothing in the right column. /settings/organization is the
 * canonical "General" page, kept at that path for backward compat
 * with deep links from the dashboard, emails, and the setup
 * checklist.
 *
 * Client-side redirect — server-side `redirect()` from next/navigation
 * intermittently surfaces a Chrome "page couldn't load" error when the
 * dev server is mid-rebuild. router.replace inside an effect renders
 * an empty page first, then navigates, which Chrome handles cleanly.
 */
export default function SettingsIndex() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings/organization')
  }, [router])
  return null
}
