'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks navigator.onLine. Returns true when offline (more convenient for
 * "show banner when offline" UIs).
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setOffline(!navigator.onLine)

    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return offline
}
