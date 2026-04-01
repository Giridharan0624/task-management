'use client'

import { useState, useEffect } from 'react'
import { useMyAttendance } from './useAttendance'

/**
 * Returns today's total hours that update live every second when the timer is running.
 * When the timer is stopped, returns the static totalHours from the API.
 */
export function useLiveHours() {
  const { data: attendance } = useMyAttendance()
  const [liveExtra, setLiveExtra] = useState(0)

  const isActive = attendance?.status === 'SIGNED_IN'
  const signInAt = attendance?.currentSignInAt

  useEffect(() => {
    if (!isActive || !signInAt) {
      setLiveExtra(0)
      return
    }
    const tick = () => {
      const elapsed = Math.max(0, (Date.now() - new Date(signInAt).getTime()) / 3600000)
      setLiveExtra(elapsed)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, signInAt])

  const staticHours = attendance?.totalHours ?? 0
  // totalHours from API already includes completed sessions.
  // liveExtra is the elapsed time of the CURRENT active session.
  // But totalHours doesn't include the active session's time (hours is null for active sessions).
  const totalHours = staticHours + (isActive ? liveExtra : 0)

  return {
    totalHours,
    isActive,
    attendance,
  }
}
