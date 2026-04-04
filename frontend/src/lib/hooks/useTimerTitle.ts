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
    // Remove the dynamic favicon and force restore default
    if (existing) existing.remove()
    // Force browser to re-read the default favicon
    const defaultIcon = document.querySelector('link[rel="icon"]:not([data-timer])') as HTMLLinkElement | null
    if (defaultIcon) {
      const href = defaultIcon.href
      defaultIcon.href = ''
      defaultIcon.href = href
    }
    return
  }

  // Load the logo and draw it with a red recording dot
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32)

    // Red dot — bottom right
    ctx.beginPath()
    ctx.arc(26, 26, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const url = canvas.toDataURL('image/png')
    const el = document.querySelector('link[rel="icon"][data-timer]') as HTMLLinkElement | null
    if (el) {
      el.href = url
    } else {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/png'
      link.href = url
      link.setAttribute('data-timer', 'true')
      document.head.appendChild(link)
    }
  }
  img.src = '/logo.png'
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
