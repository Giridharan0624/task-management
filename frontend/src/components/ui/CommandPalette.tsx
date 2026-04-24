'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/lib/hooks/useProjects'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useHasPermission } from '@/lib/hooks/usePermission'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  category: string
}

const NAV_ICON = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const PROJECT_ICON = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
const TASK_ICON = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
const USER_ICON = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: tasks } = useMyTasks()
  // `useUsers` is always called (can't conditionally call hooks) but
  // the query itself is gated below so we only surface user results to
  // OWNER/ADMIN — MEMBERs shouldn't be able to enumerate the team.
  const { data: users } = useUsers()

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Live-permission check — `nav-users` only shows when the caller
  // actually has user.list. Falls back to the role check while the
  // /orgs/current/roles fetch is in flight.
  const canListUsersPerm = useHasPermission('user.list')
  const legacyPrivileged =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const isPrivileged =
    canListUsersPerm === null ? legacyPrivileged : canListUsersPerm

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      { id: 'nav-dashboard', label: 'Dashboard', description: 'Go to dashboard', icon: NAV_ICON, action: () => router.push('/dashboard'), category: 'Navigation' },
      { id: 'nav-tasks', label: 'My Tasks', description: 'View all tasks', icon: NAV_ICON, action: () => router.push('/my-tasks'), category: 'Navigation' },
      { id: 'nav-projects', label: 'Projects', description: 'Browse projects', icon: NAV_ICON, action: () => router.push('/projects'), category: 'Navigation' },
      { id: 'nav-reports', label: 'Reports', description: 'Time reports', icon: NAV_ICON, action: () => router.push('/reports'), category: 'Navigation' },
      { id: 'nav-attendance', label: 'Attendance', description: 'View attendance', icon: NAV_ICON, action: () => router.push('/attendance'), category: 'Navigation' },
      { id: 'nav-dayoffs', label: 'Day Offs', description: 'Manage day offs', icon: NAV_ICON, action: () => router.push('/day-offs'), category: 'Navigation' },
      { id: 'nav-profile', label: 'Profile', description: 'Your profile', icon: NAV_ICON, action: () => router.push('/profile'), category: 'Navigation' },
    ]
    if (isPrivileged) {
      nav.push({ id: 'nav-users', label: 'Users', description: 'Manage users', icon: NAV_ICON, action: () => router.push('/admin/users'), category: 'Navigation' })
    }

    const projectItems: CommandItem[] = (projects ?? []).map(p => ({
      id: `project-${p.projectId}`, label: p.name, description: p.description || 'Project', icon: PROJECT_ICON,
      action: () => router.push(`/projects/${p.projectId}`), category: 'Projects',
    }))

    const taskItems: CommandItem[] = (tasks ?? []).slice(0, 15).map(t => ({
      id: `task-${t.taskId}`, label: t.title, description: t.projectName || 'Direct Task', icon: TASK_ICON,
      action: () => router.push(`/projects/${t.projectId}`), category: 'Tasks',
    }))

    // Users — privileged only. Excludes the caller so the palette never
    // shows "myself" as a navigable item (they have Profile already).
    const userItems: CommandItem[] = isPrivileged
      ? (users ?? [])
          .filter((u) => u.userId !== user?.userId)
          .slice(0, 20)
          .map((u) => ({
            id: `user-${u.userId}`,
            label: u.name || u.email,
            description: `${u.email} · ${u.systemRole}`,
            icon: USER_ICON,
            action: () => router.push(`/admin/users?focus=${encodeURIComponent(u.userId)}`),
            category: 'People',
          }))
      : []

    return [...nav, ...projectItems, ...taskItems, ...userItems]
  }, [projects, tasks, users, isPrivileged, user?.userId, router])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10)
    const q = query.toLowerCase()
    return items.filter(i => i.label.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)).slice(0, 10)
  }, [items, query])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); setOpen(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, filtered, selectedIndex])

  useEffect(() => { setSelectedIndex(0) }, [query])

  if (!open) return null

  // Group by category
  const groups = new Map<string, CommandItem[]>()
  for (const item of filtered) {
    const arr = groups.get(item.category) ?? []
    arr.push(item)
    groups.set(item.category, arr)
  }

  let flatIndex = 0

  return createPortal(
    <div className="fixed inset-0 z-[99998]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="flex items-start justify-center pt-[15vh] px-4">
        <div onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-card dark:bg-[#1a1c25] rounded-2xl shadow-2xl border border-border/80 dark:border-gray-700/50 overflow-hidden animate-fade-in-scale"
          style={{ animationDuration: '0.15s' }}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border dark:border-gray-700/50">
            <svg className="w-5 h-5 text-muted-foreground/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages, projects, tasks..."
              className="flex-1 bg-transparent text-[15px] text-foreground dark:text-gray-100 placeholder:text-muted-foreground/70 focus:outline-none" />
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-muted dark:bg-gray-700 text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/70">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-muted-foreground/70">No results for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              Array.from(groups.entries()).map(([category, categoryItems]) => (
                <div key={category}>
                  <p className="px-5 py-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{category}</p>
                  {categoryItems.map(item => {
                    const isSelected = flatIndex === selectedIndex
                    const idx = flatIndex
                    flatIndex++
                    return (
                      <button key={item.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => { item.action(); setOpen(false) }}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-muted/40 dark:hover:bg-gray-700/30'}`}>
                        <span className={`flex-shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/70'}`}>{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-foreground/95 dark:text-gray-200'}`}>{item.label}</p>
                          {item.description && <p className="text-[11px] text-muted-foreground/70 truncate">{item.description}</p>}
                        </div>
                        {isSelected && (
                          <kbd className="text-[10px] text-indigo-500 font-mono">↵</kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-border dark:border-gray-700/50 flex items-center gap-4 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted dark:bg-gray-700 font-bold">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted dark:bg-gray-700 font-bold">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted dark:bg-gray-700 font-bold">⌘K</kbd> Toggle</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
