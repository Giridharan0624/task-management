'use client'

import { useEffect, useState } from 'react'
import { serverNow } from '@/lib/utils/serverClock'

interface LiveTimerProps {
  startTime: string
  className?: string
}

function formatElapsed(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function LiveTimer({ startTime, className = '' }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startTime).getTime()
    const tick = () => {
      // serverNow() = Date.now() + offset, where offset is captured
      // from every /attendance/* response's `serverTime` field. This
      // makes the timer agree across devices even if the local OS
      // clock is drifted from NTP — the key fix for "desktop and web
      // show different times."
      const diff = Math.max(0, Math.floor((serverNow() - start) / 1000))
      setElapsed(diff)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return <span className={className}>{formatElapsed(elapsed)}</span>
}
