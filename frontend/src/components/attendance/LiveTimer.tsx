'use client'

import { useEffect, useState } from 'react'

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
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000))
      setElapsed(diff)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return <span className={className}>{formatElapsed(elapsed)}</span>
}
