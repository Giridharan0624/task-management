'use client'

import { useEffect, useState } from 'react'

/**
 * Forces a re-render on a fixed interval so components that derive
 * duration/elapsed from `Date.now()` keep their UI fresh without needing
 * explicit state for the running clock.
 */
export function useLiveTick(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return tick
}
