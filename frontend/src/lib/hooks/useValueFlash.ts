'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Returns a className that flashes briefly when `value` changes. Use on
 * badges/chips that reflect server-driven state so the user sees a cue
 * when React Query refetches land new data.
 *
 * Skips the flash on the very first render so lists don't flicker on
 * mount. After the flash duration elapses, the returned className is
 * empty, so it leaves no trace in the DOM.
 */
export function useValueFlash(
  value: string | number,
  flashClass: string = 'animate-chip-flash',
  durationMs: number = 700,
): string {
  const prev = useRef(value)
  const isFirst = useRef(true)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      prev.current = value
      return
    }
    if (prev.current !== value) {
      prev.current = value
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), durationMs)
      return () => clearTimeout(t)
    }
  }, [value, durationMs])

  return flashing ? flashClass : ''
}
