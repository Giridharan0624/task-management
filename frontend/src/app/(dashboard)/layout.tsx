'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Logo } from '@/components/ui/Logo'
import { getProfile } from '@/lib/api/userApi'
import { usePendingDayOffs } from '@/lib/hooks/useDayOffs'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useTimerTitle } from '@/lib/hooks/useTimerTitle'
import { useMyAttendance } from '@/lib/hooks/useAttendance'
import { LiveTimer } from '@/components/attendance/LiveTimer'
import { formatDuration } from '@/lib/utils/formatDuration'
import { useLiveHours } from '@/lib/hooks/useLiveHours'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { Walkthrough } from '@/components/ui/Walkthrough'
import { NotificationCenter } from '@/components/ui/NotificationCenter'
import type { User } from '@/types/user'

const adminNav = [
  { name: 'Dashboard', href: '/dashboard', icon: 'home' },
  { name: 'All Tasks', href: '/my-tasks', icon: 'tasks' },
  { name: 'Task Updates', href: '/task-updates', icon: 'update' },
  { name: 'Users', href: '/admin/users', icon: 'users' },
  { name: 'Projects', href: '/projects', icon: 'board' },
  { name: 'Reports', href: '/reports', icon: 'report' },
  { name: 'Attendance', href: '/attendance', icon: 'clock' },
  { name: 'Day Offs', href: '/day-offs', icon: 'calendar' },
]

const memberNav = [
  { name: 'Dashboard', href: '/dashboard', icon: 'home' },
  { name: 'My Tasks', href: '/my-tasks', icon: 'tasks' },
  { name: 'Projects', href: '/projects', icon: 'board' },
  { name: 'Attendance', href: '/attendance', icon: 'clock' },
  { name: 'Day Offs', href: '/day-offs', icon: 'calendar' },
]

function getNavItems(role?: string) {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return adminNav
    default: return memberNav
  }
}

function NavIcon({ type }: { type: string }) {
  const cls = "w-[18px] h-[18px]"
  switch (type) {
    case 'home':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    case 'tasks':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    case 'users':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    case 'board':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
    case 'clock':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'calendar':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    case 'report':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    case 'update':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    case 'user':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    default:
      return null
  }
}

const DESKTOP_DOWNLOADS = {
  windows: { label: 'Windows', icon: '💻', ext: '.exe' },
  linux: { label: 'Linux', icon: '🐧', ext: '.AppImage' },
  macos: { label: 'macOS', icon: '🍎', ext: '.dmg' },
}

function getOS(): 'windows' | 'linux' | 'macos' {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'windows'
}

function DesktopDownloadLink() {
  const [latest, setLatest] = useState<{ version: string; downloads: Record<string, string> } | null>(null)
  const os = getOS()

  useEffect(() => {
    fetch('https://d32wbqjdb87hcf.cloudfront.net/releases/latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLatest(data) })
      .catch(() => {})
  }, [])

  const info = DESKTOP_DOWNLOADS[os]
  const version = latest?.version || '1.0.0'
  const downloadUrl = latest?.downloads?.[os] || `https://github.com/Giridharan0624/taskflow-desktop/releases/latest`

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/20 px-3 py-2 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all group"
    >
      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      <div>
        <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-800">Desktop App {info.icon}</p>
        <p className="text-[9px] text-indigo-400">{info.label} · v{version}</p>
      </div>
    </a>
  )
}

function SidebarTimer() {
  const { user } = useAuth()
  const { totalHours, isActive, attendance } = useLiveHours()
  if (user?.systemRole === 'OWNER' || !attendance) return null

  const task = attendance.currentTask

  if (isActive && attendance.currentSignInAt) {
    return (
      <Link href="/dashboard" className="mx-3 mb-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 block hover:bg-emerald-100 transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-[11px] font-semibold text-emerald-800 truncate">{task?.taskTitle || 'Working'}</p>
        </div>
        <div className="flex items-center justify-between">
          <LiveTimer startTime={attendance.currentSignInAt} className="text-[14px] font-bold text-emerald-700 font-mono tabular-nums" />
          <span className="text-[9px] text-emerald-600 font-medium">{formatDuration(totalHours)} total</span>
        </div>
      </Link>
    )
  }

  if (totalHours > 0) {
    return (
      <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Today</span>
          <span className="text-[12px] font-bold text-gray-700 tabular-nums">{formatDuration(totalHours)}</span>
        </div>
      </div>
    )
  }

  return null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut, updateUser } = useAuth()
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
  const [profileName, setProfileName] = useState<string | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const { data: pendingDayOffs } = usePendingDayOffs()
  const { data: myTasks } = useMyTasks()
  useTimerTitle()

  // Poll profile every 15s — sync role changes, avatar, and name
  const lastRoleRef = useRef(user?.systemRole)
  const syncProfile = useCallback(() => {
    if (!user) return
    getProfile()
      .then((p: User) => {
        setAvatarUrl(p?.avatarUrl)
        setProfileName(p?.name)
        // If role changed in the backend, update auth context — triggers full re-render
        if (p?.systemRole && p.systemRole !== lastRoleRef.current) {
          lastRoleRef.current = p.systemRole
          updateUser({ systemRole: p.systemRole })
        }
      })
      .catch(() => {})
  }, [user, updateUser])

  useEffect(() => {
    syncProfile()
    const interval = setInterval(syncProfile, 15000)
    return () => clearInterval(interval)
  }, [syncProfile])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-bg)] gap-4">
        <div className="flex items-center gap-3">
          <Logo size="lg" />
        </div>
        <Spinner size="md" />
        <p className="text-[12px] text-gray-400 font-medium animate-pulse">Loading your workspace...</p>
      </div>
    )
  }

  if (!user) return null

  const navItems = getNavItems(user.systemRole)
  const closeSidebar = () => setSidebarOpen(false)

  const isPrivileged = user.systemRole === 'OWNER' || user.systemRole === 'ADMIN'

  const pendingCount = isPrivileged ? (pendingDayOffs ?? []).length : 0
  const todoTaskCount = (myTasks ?? []).filter((t) => t.status !== 'DONE').length

  const getBadgeCount = (href: string): number => {
    if (href === '/day-offs' && pendingCount > 0) return pendingCount
    if (href === '/my-tasks' && todoTaskCount > 0) return todoTaskCount
    return 0
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-gray-100">
        <Logo size="md" />
        <div className="flex items-center gap-1">
          <div className="hidden lg:block"><NotificationCenter /></div>
          <button onClick={closeSidebar} className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const badgeCount = getBadgeCount(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 nav-glow'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className={`transition-colors duration-200 ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-600'}`}>
                <NavIcon type={item.icon} />
              </span>
              {item.name}
              {badgeCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white tabular-nums shadow-sm">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mini Timer */}
      <SidebarTimer />

      {/* User info */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-gray-50 border border-gray-100">
        <Link href="/profile" onClick={closeSidebar} className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-gray-100/60 transition-colors">
          <Avatar url={avatarUrl} name={profileName || user.name || user.email} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800 truncate">{profileName || user.name || user.email}</p>
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-100 text-indigo-600 tracking-wider uppercase">{user.systemRole}</span>
          </div>
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg mt-3 px-3 py-2 text-[12px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all duration-200"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Desktop app download — auto-detects OS */}
      <DesktopDownloadLink />

      {/* NEUROSTACK branding */}
      <p className="text-center text-[10px] text-gray-400 pb-3">
        Powered by <span className="font-semibold text-gray-500">NEUROSTACK</span>
      </p>
    </>
  )

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } safe-bottom`}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-[260px] min-h-screen min-w-0 w-full">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/80 dark:bg-[#1a1c25]/90 backdrop-blur-lg border-b border-gray-100 dark:border-[#2a2d3a] px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Logo size="sm" />
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <Link href="/profile">
              <Avatar url={avatarUrl} name={profileName || user.name || user.email} size="sm" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 w-full min-w-0">
          {children}
        </main>
      </div>

      <CommandPalette />
      <Walkthrough />
    </div>
  )
}
