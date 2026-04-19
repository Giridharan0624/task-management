'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth/AuthProvider'

interface WalkthroughStep {
  title: string
  description: string
  icon: React.ReactNode
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Welcome to TaskFlow!',
    description: 'Your team\'s workspace for managing projects, tracking progress, and staying productive. Let us give you a quick tour.',
    icon: <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    title: 'Desktop App for Time Tracking',
    description: 'Download the TaskFlow Desktop App to track your work hours. It captures screenshots, monitors app usage, and syncs everything here automatically.',
    icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    title: 'Projects & Domains',
    description: 'Each project belongs to a domain — Development, Designing, Management, or Research. The domain determines the task pipeline stages your team follows.',
    icon: <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>,
  },
  {
    title: 'Task Pipeline',
    description: 'Tasks flow through stages like To Do, In Progress, Code Review, Testing, and Done. Update your task status using the dropdown on any assigned task.',
    icon: <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    title: 'Reports & Activity',
    description: 'View time reports (Summary, Detailed, Weekly) and activity reports with app usage, screenshots, and AI-generated work summaries from the desktop app.',
    icon: <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    title: 'Daily Updates',
    description: 'At the end of your day, stop the desktop timer and submit a Daily Update from your dashboard. It auto-generates a summary from your tracked sessions.',
    icon: <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    title: 'Day Off Requests',
    description: 'Request time off from the Day Offs page. Admins can approve or reject requests. You can cancel anytime. Your monthly day-off score tracks attendance.',
    icon: <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    title: 'You\'re All Set!',
    description: 'Download the Desktop App from your dashboard to start tracking. Use Ctrl+K to search anything, and check the bell icon for notifications. Welcome to the team!',
    icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>,
  },
]

const STORAGE_PREFIX = 'taskflow_walkthrough_seen_'

export function Walkthrough() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user || !mounted) return
    const key = STORAGE_PREFIX + user.userId
    const seen = localStorage.getItem(key)
    if (seen) return

    // Only show walkthrough for accounts created in the last 5 minutes (truly new users)
    if (user.createdAt) {
      const created = new Date(user.createdAt).getTime()
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      if (created < fiveMinAgo) {
        // Account is older than 5 minutes — not a first login, skip walkthrough
        localStorage.setItem(key, 'true')
        return
      }
    }

    setVisible(true)
  }, [user, mounted])

  const dismiss = useCallback(() => {
    setVisible(false)
    if (user) localStorage.setItem(STORAGE_PREFIX + user.userId, 'true')
  }, [user])

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  const prev = () => {
    if (step > 0) setStep(s => s - 1)
  }

  if (!visible || !mounted) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-card dark:bg-[#191b24] rounded-2xl shadow-2xl border border-border/80 dark:border-gray-700/50 w-full max-w-md overflow-hidden animate-fade-in-scale"
        style={{ animationDuration: '0.2s' }}>

        {/* Progress bar */}
        <div className="h-1 bg-muted dark:bg-gray-800">
          <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-semibold text-muted-foreground/70 dark:text-muted-foreground tabular-nums">
              {step + 1} of {STEPS.length}
            </span>
            <button onClick={dismiss}
              className="text-[11px] font-semibold text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/50 transition-colors">
              Skip tour
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-muted/40 dark:bg-gray-800 flex items-center justify-center mb-5 mx-auto">
            {current.icon}
          </div>

          {/* Text */}
          <h2 className="text-[18px] font-bold text-foreground dark:text-gray-100 text-center mb-2">
            {current.title}
          </h2>
          <p className="text-[13px] text-muted-foreground dark:text-muted-foreground/70 text-center leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`rounded-full transition-all ${i === step ? 'w-6 h-2 bg-indigo-500' : 'w-2 h-2 bg-muted dark:bg-gray-700 hover:bg-gray-300'}`} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 pb-8">
          {!isFirst ? (
            <button onClick={prev}
              className="text-[13px] font-semibold text-muted-foreground hover:text-foreground/85 dark:text-muted-foreground/70 dark:hover:text-gray-200 transition-colors">
              Back
            </button>
          ) : (
            <div />
          )}
          <button onClick={next}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-[13px] font-semibold text-white transition-all shadow-sm">
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Call this to reset the walkthrough (show it again on next page load).
 */
export function resetWalkthrough(userId?: string) {
  if (userId) {
    localStorage.removeItem(STORAGE_PREFIX + userId)
  }
}
