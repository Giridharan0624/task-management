'use client'

import { useEffect, useState } from 'react'

interface LiveTimerProps {
  startTime: string
  className?: string
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function LiveTimer({ startTime, className = '' }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startTime).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return <span className={className}>{formatElapsed(elapsed)}</span>
}
