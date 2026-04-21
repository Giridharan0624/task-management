'use client'

import { useEffect } from 'react'

/**
 * When `dirty` is true, prompt the browser's standard "leave page" dialog on
 * tab close / reload. Doesn't guard in-app navigation (Next.js router does not
 * expose a blockable navigation API today) — for that the parent should show
 * its own confirm dialog before closing a modal or navigating.
 *
 * Handy for long-lived forms (settings, daily update, day-off request).
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome ignores the message string; assigning returnValue is what
      // actually triggers the confirm.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
