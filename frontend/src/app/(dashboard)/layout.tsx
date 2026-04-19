'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { useT } from '@/lib/tenant/useT'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Users,
  KanbanSquare,
  BarChart3,
  Clock,
  Calendar,
  Settings,
  LogOut,
  Menu,
  Download,
  Monitor,
  Apple,
  X,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'
import { LiveDot } from '@/components/ui/LiveDot'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Separator } from '@/components/ui/Separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { getProfile } from '@/lib/api/userApi'
import { usePendingDayOffs } from '@/lib/hooks/useDayOffs'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useTimerTitle } from '@/lib/hooks/useTimerTitle'
import { LiveTimer } from '@/components/attendance/LiveTimer'
import { formatDuration } from '@/lib/utils/formatDuration'
import { useLiveHours } from '@/lib/hooks/useLiveHours'
import { UpcomingBirthdays } from '@/components/ui/BirthdayBanner'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { Walkthrough } from '@/components/ui/Walkthrough'
import { NotificationCenter } from '@/components/ui/NotificationCenter'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'

interface NavItem {
  /** i18n key on BASE_TERMINOLOGY. Resolved through useT() at render
   * time so per-tenant terminology overrides apply. Falls back to the
   * key itself if no override exists. */
  nameKey: string
  /** Default-locale label (also the fallback if the i18n key is missing). */
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  /** Optional feature flag from OrgSettings.features. When set, the
   * nav item is hidden if the tenant has the feature disabled. */
  feature?: string
}

/** Returns true if the nav item should be visible. Missing feature key
 * defaults to enabled (new features are not retroactively hidden). */
function isFeatureEnabled(
  feature: string | undefined,
  features: Record<string, boolean> | null | undefined,
): boolean {
  if (!feature) return true
  if (!features) return true
  return features[feature] !== false
}

const adminNav: NavItem[] = [
  { nameKey: 'nav.dashboard', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.my_tasks', name: 'All Tasks', href: '/my-tasks', icon: CheckSquare },
  { nameKey: 'nav.task_updates', name: 'Daily Updates', href: '/task-updates', icon: FileText, feature: 'task_updates' },
  { nameKey: 'user.team', name: 'Users', href: '/admin/users', icon: Users },
  { nameKey: 'nav.projects', name: 'Projects', href: '/projects', icon: KanbanSquare },
  { nameKey: 'nav.reports', name: 'Reports', href: '/reports', icon: BarChart3 },
  { nameKey: 'nav.attendance', name: 'Attendance', href: '/attendance', icon: Clock, feature: 'activity_monitoring' },
  { nameKey: 'nav.day_offs', name: 'Day Offs', href: '/day-offs', icon: Calendar, feature: 'day_offs' },
]

const ownerNav: NavItem[] = [
  ...adminNav,
  { nameKey: 'nav.settings', name: 'Settings', href: '/settings/organization', icon: Settings },
]

const memberNav: NavItem[] = [
  { nameKey: 'nav.dashboard', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.my_tasks', name: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
  { nameKey: 'nav.projects', name: 'Projects', href: '/projects', icon: KanbanSquare },
  { nameKey: 'nav.attendance', name: 'Attendance', href: '/attendance', icon: Clock, feature: 'activity_monitoring' },
  { nameKey: 'nav.day_offs', name: 'Day Offs', href: '/day-offs', icon: Calendar, feature: 'day_offs' },
]

function getNavItems(role?: string) {
  switch (role) {
    case 'OWNER':
      return ownerNav
    case 'ADMIN':
      return adminNav
    default:
      return memberNav
  }
}

function getOS(): 'windows' | 'linux' | 'macos' {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'windows'
}

function DesktopDownloadLink() {
  const [latest, setLatest] = useState<{
    version: string
    downloads: Record<string, string>
  } | null>(null)
  const userOS = getOS()

  useEffect(() => {
    fetch('https://dp2uotzxlo5a5.cloudfront.net/releases/latest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLatest(data)
      })
      .catch(() => {})
  }, [])

  const version = latest?.version || '1.0.0'
  const platforms: {
    key: 'windows' | 'linux' | 'macos'
    label: string
    Icon: React.ComponentType<{ className?: string }>
  }[] = [
    { key: 'windows', label: 'Windows', Icon: Monitor },
    { key: 'linux', label: 'Linux', Icon: Monitor },
    { key: 'macos', label: 'macOS', Icon: Apple },
  ]

  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-semibold text-primary">Desktop App</p>
        </div>
        <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[8px] font-bold text-primary">
          v{version}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 px-2 pb-2">
        {platforms.map((p) => {
          const url =
            latest?.downloads?.[p.key] ||
            `https://github.com/Giridharan0624/taskflow-desktop/releases/latest`
          const isUserOS = p.key === userOS
          return (
            <a
              key={p.key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-lg py-2.5 transition-all',
                isUserOS
                  ? 'bg-primary/10 ring-1 ring-primary/20'
                  : 'hover:bg-primary/10'
              )}
            >
              <p.Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isUserOS
                    ? 'text-primary'
                    : 'text-primary/60 group-hover:text-primary'
                )}
              />
              <span
                className={cn(
                  'text-[9px] font-semibold transition-colors',
                  isUserOS
                    ? 'text-primary'
                    : 'text-primary/70 group-hover:text-primary'
                )}
              >
                {p.label}
              </span>
              {isUserOS && (
                <Download className="absolute right-1 top-1 h-2.5 w-2.5 text-primary/70" />
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function SidebarTimer() {
  const { user } = useAuth()
  const { totalHours, isActive, attendance } = useLiveHours()
  if (user?.systemRole === 'OWNER' || !attendance) return null

  const task = attendance.currentTask

  if (isActive && attendance.currentSignInAt) {
    return (
      <Link
        href="/dashboard"
        className="mx-3 mb-2 block rounded-xl border border-emerald-200 bg-emerald-50 p-3 transition-colors hover:bg-emerald-100"
      >
        <div className="mb-1 flex items-center gap-2">
          <LiveDot size="sm" />
          <p className="truncate text-[11px] font-semibold text-emerald-800">
            {task?.taskTitle || 'Working'}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <LiveTimer
            startTime={attendance.currentSignInAt}
            className="text-[14px] font-bold text-emerald-700 font-mono tabular-nums"
          />
          <span className="text-[9px] font-medium text-emerald-600">
            {formatDuration(totalHours)} total
          </span>
        </div>
      </Link>
    )
  }

  if (totalHours > 0) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground">
            {formatDuration(totalHours)}
          </span>
        </div>
      </div>
    )
  }

  return null
}

interface SidebarContentProps {
  user: User
  navItems: NavItem[]
  pathname: string
  avatarUrl?: string
  profileName?: string
  signOut: () => void
  onNavClick?: () => void
  getBadgeCount: (href: string) => number
  features: Record<string, boolean> | null | undefined
}

function SidebarContent({
  user,
  navItems,
  pathname,
  avatarUrl,
  profileName,
  signOut,
  onNavClick,
  getBadgeCount,
  features,
}: SidebarContentProps) {
  const t = useT()
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo + actions */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-1">
          <div className="hidden lg:block">
            <NotificationCenter />
          </div>
          <ThemeToggle />
          {onNavClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavClick}
              className="lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation — items with `feature` are hidden when the tenant
          has that feature disabled. Missing entries default to enabled
          so a freshly-added feature isn't retroactively hidden. */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems
          .filter((item) => isFeatureEnabled(item.feature, features))
          .map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const badgeCount = getBadgeCount(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-active text-primary nav-glow'
                  : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-sidebar-muted group-hover:text-sidebar-foreground'
                )}
                strokeWidth={1.8}
              />
              <span className="truncate">{t(item.nameKey) || item.name}</span>
              {badgeCount > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold tabular-nums text-destructive-foreground shadow-sm">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <SidebarTimer />

      <div className="mx-3 mb-2">
        <UpcomingBirthdays />
      </div>

      {/* User profile card */}
      <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-hover/80 p-3">
        <Link
          href="/profile"
          onClick={onNavClick}
          className="-m-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/60"
        >
          <Avatar
            url={avatarUrl}
            name={profileName || user.name || user.email}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {profileName || user.name || user.email}
            </p>
            <Badge tone="primary" size="sm" className="mt-0.5">
              {user.systemRole}
            </Badge>
          </div>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={signOut}
          className="mt-3 w-full border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </div>

      <DesktopDownloadLink />

      <p className="pb-3 text-center text-[10px] text-muted-foreground">
        Powered by{' '}
        <span className="font-semibold text-foreground/60">NEUROSTACK</span>
      </p>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, signOut, updateUser } = useAuth()
  const { current: currentTenant } = useTenant()
  const tenantFeatures = currentTenant?.settings?.features
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

  const lastRoleRef = useRef(user?.systemRole)
  const syncProfile = useCallback(() => {
    if (!user) return
    getProfile()
      .then((p: User) => {
        setAvatarUrl(p?.avatarUrl)
        setProfileName(p?.name)
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo size="lg" />
        <Spinner size="md" />
        <p className="animate-pulse text-xs font-medium text-muted-foreground">
          Loading your workspace...
        </p>
      </div>
    )
  }

  if (!user) return null

  const navItems = getNavItems(user.systemRole)
  const features = tenantFeatures
  const closeSidebar = () => setSidebarOpen(false)

  const isPrivileged =
    user.systemRole === 'OWNER' || user.systemRole === 'ADMIN'

  const pendingCount = isPrivileged ? (pendingDayOffs ?? []).length : 0
  const todoTaskCount = (myTasks ?? []).filter((t) => t.status !== 'DONE').length

  const getBadgeCount = (href: string): number => {
    if (href === '/day-offs' && pendingCount > 0) return pendingCount
    if (href === '/my-tasks' && todoTaskCount > 0) return todoTaskCount
    return 0
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen bg-background">
        {/* Desktop sidebar — fixed 260px */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-sidebar-border lg:flex safe-bottom">
          <SidebarContent
            user={user}
            navItems={navItems}
            pathname={pathname}
            avatarUrl={avatarUrl}
            profileName={profileName}
            signOut={signOut}
            getBadgeCount={getBadgeCount}
            features={features}
          />
        </aside>

        {/* Mobile sidebar via Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[280px] p-0 border-r border-sidebar-border"
          >
            <SidebarContent
              user={user}
              navItems={navItems}
              pathname={pathname}
              avatarUrl={avatarUrl}
              profileName={profileName}
              signOut={signOut}
              onNavClick={closeSidebar}
              getBadgeCount={getBadgeCount}
              features={features}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col lg:ml-[260px]">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur-lg lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <NotificationCenter />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <Link href="/profile" className="ml-1">
                <Avatar
                  url={avatarUrl}
                  name={profileName || user.name || user.email}
                  size="sm"
                />
              </Link>
            </div>
          </header>

          <main className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>

        <CommandPalette />
        <Walkthrough />
        <Separator className="sr-only" />
      </div>
    </TooltipProvider>
  )
}
