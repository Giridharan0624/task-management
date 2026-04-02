'use client'

import { useEffect, useRef } from 'react'
import { useMyAttendance } from './useAttendance'
import { startTimerWorker, stopTimerWorker } from '@/lib/utils/timerWorker'

function formatElapsed(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Swap the favicon to show a green recording dot when timer is active */
function setTimerFavicon(active: boolean) {
  const existing = document.querySelector('link[rel="icon"][data-timer]') as HTMLLinkElement | null

  if (!active) {
    // Remove the dynamic favicon — browser falls back to the default /icon
    if (existing) existing.remove()
    return
  }

  // Draw a 32x32 favicon with the TaskFlow icon + green dot
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background — indigo rounded rect
  ctx.beginPath()
  ctx.roundRect(0, 0, 32, 32, 8)
  const grad = ctx.createLinearGradient(0, 0, 32, 32)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = grad
  ctx.fill()

  // "T" letter
  ctx.fillStyle = 'white'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('T', 16, 17)

  // Green dot — bottom right
  ctx.beginPath()
  ctx.arc(26, 26, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#10b981'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const url = canvas.toDataURL('image/png')

  if (existing) {
    existing.href = url
  } else {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    link.href = url
    link.setAttribute('data-timer', 'true')
    document.head.appendChild(link)
  }
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
      // Restore original title and favicon when timer stops
      if (originalTitle.current && document.title !== originalTitle.current) {
        document.title = originalTitle.current
      }
      setTimerFavicon(false)
      return
    }

    const start = new Date(attendance.currentSignInAt!).getTime()
    const taskName = attendance.currentTask?.taskTitle || 'Working'

    setTimerFavicon(true)

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000))
      document.title = `${formatElapsed(diff)} · ${taskName} — TaskFlow`
    }

    tick()
    startTimerWorker(tick)
    return () => stopTimerWorker()
  }, [attendance?.status, attendance?.currentSignInAt, attendance?.currentTask?.taskTitle])
}
