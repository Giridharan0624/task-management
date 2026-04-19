'use client'

import { useEffect } from 'react'

import { useTenant } from '@/lib/tenant/TenantProvider'

/** Updates `document.title` to use the current tenant's display name as
 * the suffix. Mounts once at the app root; the title format becomes
 * `{page title} | {tenant name}` once a page sets its own title via
 * Next.js metadata, or just `{tenant name}` on pages without a title.
 *
 * Server-rendered titles still say "TaskFlow" (Next.js metadata is
 * resolved at build time and can't read browser/tenant state); this hook
 * patches the browser tab once the tenant context resolves on the
 * client. Acceptable tradeoff for SPA navigation. */
export function useTenantDocumentTitle() {
  const { summary, current } = useTenant()
  const displayName =
    summary?.displayName || current?.org?.name || 'TaskFlow'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const docTitle = document.title
    if (!docTitle) {
      document.title = displayName
      return
    }
    if (docTitle === 'TaskFlow' || docTitle === displayName) {
      document.title = displayName
      return
    }
    // Replace any leading "TaskFlow" or trailing "| TaskFlow" with displayName
    const replaced = docTitle
      .replace(/^TaskFlow(\s*\|\s*)/i, `${displayName}$1`)
      .replace(/(\s*\|\s*)TaskFlow$/i, `$1${displayName}`)
    if (replaced !== docTitle) {
      document.title = replaced
    }
  }, [displayName])
}
