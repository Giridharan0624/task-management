'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { useT } from '@/lib/tenant/useT'
import { useEffectivePermissions } from '@/lib/hooks/usePermission'
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
  Terminal,
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
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { SuspendedScreen } from '@/components/tenant/SuspendedScreen'
import { PendingDeletionBanner } from '@/components/tenant/PendingDeletionBanner'
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
  /** Optional backend permission string. When set, the nav item is
   * hidden unless the caller's live role permissions include it
   * (live-read via useEffectivePermissions from the roles API). This
   * makes the sidebar respect OWNER-level permission edits without
   * any redeploy — the Admin's "Users" link disappears within one
   * React Query staleTime after OWNER removes `user.list` from the
   * Admin role. */
  requiredPermission?: string
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

// Single master nav list — every item either has no gate (always
// visible to authenticated users in this org) or declares a
// `requiredPermission` that the SidebarContent filter checks against
// the caller's live permission set. This is what makes custom roles
// "just work": a tenant-defined role called `tester` with
// `project.list` + `task.list` will see Projects but not Users, with
// no hardcoded role → menu mapping anywhere in the tree.
//
// Historical note: this replaces a three-way switch (adminNav /
// ownerNav / memberNav / default → memberNav) where any role string
// that wasn't literally OWNER or ADMIN fell through to the member
// menu. That meant a custom role with admin-tier permissions would
// still see only the member menu — the permission check on the
// individual /admin/users link was moot because the link was never
// added to the nav list in the first place.
const navBase: NavItem[] = [
  // Personal-scope items — every authenticated user sees these.
  { nameKey: 'nav.dashboard', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.my_tasks', name: 'My tasks', href: '/my-tasks', icon: CheckSquare },
  // Role-gated items — filtered out unless the caller's permissions
  // include the declared key. `feature` is an independent org-level
  // toggle (an OWNER can disable Daily Updates for the whole tenant).
  { nameKey: 'nav.task_updates', name: 'Daily Updates', href: '/task-updates', icon: FileText, feature: 'task_updates', requiredPermission: 'taskupdate.list.all' },
  { nameKey: 'user.team', name: 'Users', href: '/admin/users', icon: Users, requiredPermission: 'user.list' },
  { nameKey: 'nav.projects', name: 'Projects', href: '/projects', icon: KanbanSquare, requiredPermission: 'project.list' },
  { nameKey: 'nav.reports', name: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: 'user.progress.view' },
  { nameKey: 'nav.attendance', name: 'Attendance', href: '/attendance', icon: Clock, feature: 'activity_monitoring' },
  { nameKey: 'nav.day_offs', name: 'Day Offs', href: '/day-offs', icon: Calendar, feature: 'day_offs' },
  { nameKey: 'nav.settings', name: 'Settings', href: '/settings/organization', icon: Settings, requiredPermission: 'settings.view' },
]

/** Returns the master nav list with the `/my-tasks` label swapped to
 *  "All tasks" for callers whose permissions include `task.view.all`
 *  (reflecting the fact that /my-tasks auto-flips to team scope for
 *  those users). Everything else is handled by the permission filter
 *  in SidebarContent — this function doesn't switch on role strings. */
function buildNavItems(effectivePermissions: Set<string> | null): NavItem[] {
  const canSeeAllTasks = effectivePermissions?.has('task.view.all') ?? false
  return navBase.map((item) =>
    item.href === '/my-tasks' && canSeeAllTasks
      ? { ...item, nameKey: 'nav.all_tasks', name: 'All tasks' }
      : item,
  )
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
  // All three icons go through /api/download/[platform] — same direct-
  // download pipeline the /download page uses. Linux defaults to .deb;
  // a tiny "All formats" link at the bottom routes to /download for
  // users who want the AppImage or a specific distribution.
  const platforms: {
    key: 'windows' | 'linux' | 'macos'
    label: string
    href: string
    Icon: React.ComponentType<{ className?: string }>
  }[] = [
    {
      key: 'windows',
      label: 'Windows',
      href: '/api/download/windows',
      Icon: Monitor,
    },
    {
      key: 'linux',
      label: 'Linux',
      href: '/api/download/linux?format=deb',
      Icon: Terminal,
    },
    {
      key: 'macos',
      label: 'macOS',
      href: '/api/download/macos',
      Icon: Apple,
    },
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
      <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
        {platforms.map((p) => {
          const isUserOS = p.key === userOS
          return (
            <a
              key={p.key}
              href={p.href}
              download
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
      <Link
        href="/download"
        className="block border-t border-primary/10 px-3 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
      >
        All formats and system requirements →
      </Link>
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
  /** Caller's live permission set (from /orgs/current/roles), or
   *  null while loading. Nav items declaring `requiredPermission`
   *  are filtered against this. Null disables the filter — the role-
   *  based `getNavItems` output is shown optimistically so the first
   *  paint isn't degraded. */
  effectivePermissions: Set<string> | null
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
  effectivePermissions,
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
      <nav
        aria-label="Primary"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5"
      >
        {navItems
          .filter((item) => isFeatureEnabled(item.feature, features))
          // Permission gate. Session 8 dropped the three per-role nav
          // lists in favor of one master list filtered purely by
          // permission, so this filter is the ONLY thing preventing
          // members from seeing admin routes — treat changes here with
          // care.
          //
          // Loading fallback: when effectivePermissions is null the
          // /orgs/current/roles fetch is in flight. To avoid flashing
          // admin items to a member, fall back to the legacy
          // privileged-tier check (OWNER/ADMIN see gated items; custom
          // roles and MEMBER don't). Once permissions arrive, the exact
          // check takes over and the sidebar reconciles.
          .filter((item) => {
            if (!item.requiredPermission) return true
            if (effectivePermissions === null) {
              return (
                user.systemRole === 'OWNER' || user.systemRole === 'ADMIN'
              )
            }
            return effectivePermissions.has(item.requiredPermission)
          })
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
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 pressable',
                isActive
                  ? 'bg-sidebar-active text-primary nav-glow'
                  : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover hover:translate-x-0.5'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors icon-pop',
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
  // Live permission set — called at the top of the component (before
  // any early returns) to satisfy React's hook-call ordering rule.
  // Nav items with `requiredPermission` filter against this inside
  // <SidebarContent>. Null while loading, which makes the filter a
  // no-op so the first paint shows the role-based default.
  const effectivePermissions = useEffectivePermissions()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  // Email-verification gate. `emailVerified === false` (not undefined)
  // triggers the redirect — undefined means a pre-rollout token, which
  // we treat as verified for backward compat. Legacy users never see
  // this redirect.
  useEffect(() => {
    if (!isLoading && user && user.emailVerified === false) {
      router.replace('/verify-email')
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

  // Block render while the email-verify redirect resolves — avoids a
  // flash of dashboard UI for unverified users. The useEffect above
  // pushes them to /verify-email on the next tick.
  if (user.emailVerified === false) return null

  // Tenant-level kill switch. If the org is suspended by a platform
  // operator, every dashboard route renders a single block instead of
  // the normal shell — avoids half-working states where reads succeed
  // but every write returns 403.
  if (currentTenant?.org?.status === 'SUSPENDED') {
    return <SuspendedScreen orgName={currentTenant.org.name} />
  }

  const navItems = buildNavItems(effectivePermissions)
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
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-lg"
      >
        Skip to main content
      </a>
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
            effectivePermissions={effectivePermissions}
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
              effectivePermissions={effectivePermissions}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col lg:ml-[260px]">
          {currentTenant?.org?.status === 'PENDING_DELETION' &&
            currentTenant.org.deletedAt && (
              <PendingDeletionBanner
                deletedAt={currentTenant.org.deletedAt}
                isOwner={user.systemRole === 'OWNER'}
              />
            )}
          <OfflineBanner />
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

          <main
            id="main-content"
            tabIndex={-1}
            className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 focus-visible:outline-none"
          >
            <ErrorBoundary resetKey={pathname}>
              {children}
            </ErrorBoundary>
          </main>
        </div>

        <CommandPalette />
        <Walkthrough />
        <Separator className="sr-only" />
      </div>
    </TooltipProvider>
  )
}
