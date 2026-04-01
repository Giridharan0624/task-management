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
    description: 'TaskFlow helps you manage projects, track time, and collaborate with your team. Let us show you around.',
    icon: <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    title: 'Time Tracker',
    description: 'Track your work hours with the built-in timer. Select a project and task, type what you\'re working on, and hit Start. Use "Meeting" for quick meeting tracking.',
    icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    title: 'Projects & Tasks',
    description: 'Each project has its own domain (Development, Designing, Management, or Research) with unique pipeline steps. Create tasks, assign team members, and track progress.',
    icon: <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>,
  },
  {
    title: 'Task Pipeline',
    description: 'Tasks move through stages like To Do, In Progress, Testing, and Done. Each domain has its own workflow. Update status by clicking the dropdown on any task.',
    icon: <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    title: 'Reports & Analytics',
    description: 'View detailed time reports in Summary, Detailed, and Weekly formats. Each project also has its own report tab with charts and breakdowns.',
    icon: <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    title: 'Daily Task Updates',
    description: 'At the end of your day, submit a Task Update from your dashboard. It auto-generates from your tracked sessions. Stop your timer first, then click Submit.',
    icon: <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    title: 'Day Off Requests',
    description: 'Need a day off? Submit a request from the Day Offs page. Your CEO/MD will approve or reject it. You can cancel anytime.',
    icon: <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    title: 'Quick Navigation',
    description: 'Press Ctrl+K (or Cmd+K) to open the Command Palette. Search for any page, project, or task instantly. Check the bell icon for notifications about overdue tasks.',
    icon: <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    title: 'Your Profile',
    description: 'Visit your Profile to upload a photo, add skills, and fill in your personal info. A completeness ring shows your progress. Toggle dark mode from there too.',
    icon: <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    title: 'You\'re All Set!',
    description: 'Start by exploring your Dashboard. Track your first task, check out your projects, and make TaskFlow your team\'s home for work.',
    icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>,
  },
]

const STORAGE_KEY = 'taskflow_walkthrough_seen'

export function Walkthrough() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user || !mounted) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) setVisible(true)
  }, [user, mounted])

  const dismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

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
      <div className="relative bg-white dark:bg-[#191b24] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 w-full max-w-md overflow-hidden animate-fade-in-scale"
        style={{ animationDuration: '0.2s' }}>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 tabular-nums">
              {step + 1} of {STEPS.length}
            </span>
            <button onClick={dismiss}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Skip tour
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-5 mx-auto">
            {current.icon}
          </div>

          {/* Text */}
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
            {current.title}
          </h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`rounded-full transition-all ${i === step ? 'w-6 h-2 bg-indigo-500' : 'w-2 h-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'}`} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 pb-8">
          {!isFirst ? (
            <button onClick={prev}
              className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
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
export function resetWalkthrough() {
  localStorage.removeItem(STORAGE_KEY)
}
