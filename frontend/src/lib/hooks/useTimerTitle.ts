'use client'

import { useEffect, useRef } from 'react'
import { useMyAttendance } from './useAttendance'

function formatElapsed(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useTimerTitle() {
  const { data: attendance } = useMyAttendance()
  const originalTitle = useRef<string>('')

  useEffect(() => {
    if (!originalTitle.current) {
      originalTitle.current = document.title
    }

    const isActive = attendance?.status === 'SIGNED_IN' && attendance?.currentSignInAt
    if (!isActive) {
      // Restore original title when timer stops
      if (originalTitle.current && document.title !== originalTitle.current) {
        document.title = originalTitle.current
      }
      return
    }

    const start = new Date(attendance.currentSignInAt!).getTime()
    const taskName = attendance.currentTask?.taskTitle || 'Working'

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000))
      document.title = `${formatElapsed(diff)} · ${taskName} — TaskFlow`
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [attendance?.status, attendance?.currentSignInAt, attendance?.currentTask?.taskTitle])
}
