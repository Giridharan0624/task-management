'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useLiveHours } from '@/lib/hooks/useLiveHours'
import { formatDuration } from '@/lib/utils/formatDuration'
import { TASK_STATUS_LABEL } from '@/types/task'
import { parseDeadline } from '@/lib/utils/deadline'

interface Notification {
  id: string
  type: 'overdue' | 'deadline' | 'timer' | 'info'
  title: string
  description: string
  href?: string
  time?: string
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const { data: tasks } = useMyTasks()
  const { totalHours: liveTotal, attendance } = useLiveHours()

  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = []
    const now = new Date()

    // Overdue tasks
    for (const t of tasks ?? []) {
      if (t.status === 'DONE' || !t.deadline) continue
      const dl = parseDeadline(t.deadline)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const deadlineDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate())
      const diffDays = Math.round((deadlineDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        notifs.push({
          id: `overdue-${t.taskId}`, type: 'overdue',
          title: t.title, description: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`,
          href: `/projects/${t.projectId}`,
        })
      } else if (diffDays <= 1) {
        notifs.push({
          id: `deadline-${t.taskId}`, type: 'deadline',
          title: t.title, description: diffDays === 0 ? 'Due today' : 'Due tomorrow',
          href: `/projects/${t.projectId}`,
        })
      }
    }

    // Timer reminder
    if (attendance && attendance.status === 'SIGNED_IN' && attendance.currentSignInAt) {
      const elapsed = (now.getTime() - new Date(attendance.currentSignInAt).getTime()) / (1000 * 60 * 60)
      if (elapsed > 4) {
        notifs.push({
          id: 'timer-long', type: 'timer',
          title: 'Timer running for ' + formatDuration(elapsed),
          description: attendance.currentTask?.taskTitle || 'Are you still working?',
          href: '/dashboard',
        })
      }
    }

    // Today's hours
    if (liveTotal > 0) {
      notifs.push({
        id: 'today-hours', type: 'info',
        title: `${formatDuration(liveTotal)} tracked today`,
        description: `${attendance?.sessions?.length ?? 0} session${(attendance?.sessions?.length ?? 0) !== 1 ? 's' : ''}`,
        href: '/attendance',
      })
    }

    return notifs
  }, [tasks, attendance])

  const urgentCount = notifications.filter(n => n.type === 'overdue' || n.type === 'timer').length

  const typeIcon: Record<string, React.ReactNode> = {
    overdue: <div className="w-2 h-2 rounded-full bg-red-500" />,
    deadline: <div className="w-2 h-2 rounded-full bg-amber-400" />,
    timer: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
    info: <div className="w-2 h-2 rounded-full bg-blue-400" />,
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('[data-notification-panel]') && !target.closest('[data-notification-trigger]')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button data-notification-trigger onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        {notifications.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${urgentCount > 0 ? 'bg-red-500' : 'bg-indigo-500'}`}>
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div data-notification-panel
          className="fixed top-14 right-4 z-[9999] w-80 bg-white dark:bg-[#191b24] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden animate-fade-in-scale"
          style={{ animationDuration: '0.15s' }}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Notifications</h3>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold px-1.5 py-0.5 rounded-md">{notifications.length}</span>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-8 h-8 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <p className="text-[12px] text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {notifications.map(n => (
                  <Link key={n.id} href={n.href || '#'} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                    <div className="mt-1.5 flex-shrink-0">{typeIcon[n.type]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{n.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
