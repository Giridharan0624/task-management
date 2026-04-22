'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  FileText,
  CalendarCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { usePendingDayOffs } from '@/lib/hooks/useDayOffs'
import { useTodayAttendance, useMyAttendance } from '@/lib/hooks/useAttendance'
import { useTaskUpdates, useMyTaskUpdate } from '@/lib/hooks/useTaskUpdates'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { cn } from '@/lib/utils'

interface TodayHeroProps {
  userName?: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

type Tone = 'danger' | 'warning' | 'info'

interface ActionPrompt {
  key: string
  tone: Tone
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  message: string
  cta: string
  href: string
  count: number
}

const toneStyles: Record<Tone, { bg: string; border: string; icon: string; text: string }> = {
  danger: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/20',
    icon: 'text-destructive bg-destructive/10',
    text: 'text-destructive',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-700 bg-amber-100',
    text: 'text-amber-800',
  },
  info: {
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    icon: 'text-primary bg-primary/10',
    text: 'text-primary',
  },
}

export function TodayHero({ userName, role }: TodayHeroProps) {
  const isMember = role === 'MEMBER'
  const { data: myTasks } = useMyTasks()
  const { data: todayAttendance } = useTodayAttendance()
  const today = new Date().toISOString().slice(0, 10)
  // Admin-only queries — skipped for members via `enabled: false` downstream
  // wouldn't work here since the hooks don't take that param; instead we
  // just don't read the data on the member branch.
  const { data: todayUpdates } = useTaskUpdates(today)
  const { data: pendingDayOffs } = usePendingDayOffs()
  // Member-only: has the user submitted today's own daily update?
  const { data: myUpdate } = useMyTaskUpdate()
  const { data: myAttendance } = useMyAttendance()

  const overdueCount = useMemo(
    () =>
      (myTasks ?? []).filter((t) => checkOverdue(t.deadline, t.status)).length,
    [myTasks]
  )

  const pendingUpdatesCount = useMemo(() => {
    if (!todayAttendance) return 0
    const submitted = new Set((todayUpdates ?? []).map((u) => u.userId))
    return todayAttendance.filter(
      (a) => a.sessions && a.sessions.length > 0 && !submitted.has(a.userId)
    ).length
  }, [todayAttendance, todayUpdates])

  const dayOffCount = pendingDayOffs?.length ?? 0

  // Member: has any sessions today but no update submitted yet.
  // getMyTaskUpdate returns TaskUpdate (submitted) | PendingTaskUpdate | null.
  // Discriminated by whether `updateId` is present.
  const memberNeedsUpdate = useMemo(() => {
    if (!isMember) return false
    const hasSessionsToday = Boolean(
      myAttendance?.sessions && myAttendance.sessions.length > 0
    )
    const submittedToday = Boolean(myUpdate && 'updateId' in myUpdate)
    return hasSessionsToday && !submittedToday
  }, [isMember, myAttendance, myUpdate])

  const prompts: ActionPrompt[] = (
    isMember
      ? [
          overdueCount > 0 && {
            key: 'overdue',
            tone: 'danger' as Tone,
            icon: AlertTriangle,
            message: `${overdueCount} task${overdueCount === 1 ? '' : 's'} overdue`,
            cta: 'Review now',
            href: '/my-tasks',
            count: overdueCount,
          },
          memberNeedsUpdate && {
            key: 'my-update',
            tone: 'warning' as Tone,
            icon: FileText,
            message: "You haven't submitted today's daily update",
            cta: 'Submit now',
            href: '/task-updates',
            count: 1,
          },
        ]
      : [
          overdueCount > 0 && {
            key: 'overdue',
            tone: 'danger' as Tone,
            icon: AlertTriangle,
            message: `${overdueCount} task${overdueCount === 1 ? '' : 's'} overdue`,
            cta: 'Review now',
            href: '/my-tasks',
            count: overdueCount,
          },
          pendingUpdatesCount > 0 && {
            key: 'updates',
            tone: 'warning' as Tone,
            icon: FileText,
            message: `${pendingUpdatesCount} team member${pendingUpdatesCount === 1 ? '' : 's'} missing today's update`,
            cta: 'Nudge team',
            href: '/task-updates',
            count: pendingUpdatesCount,
          },
          dayOffCount > 0 && {
            key: 'dayoff',
            tone: 'info' as Tone,
            icon: CalendarCheck,
            message: `${dayOffCount} day-off request${dayOffCount === 1 ? '' : 's'} awaiting approval`,
            cta: 'Approve',
            href: '/day-offs',
            count: dayOffCount,
          },
        ]
  ).filter(Boolean) as ActionPrompt[]

  const firstName = userName?.split(' ')[0] ?? 'there'
  const greeting = getGreeting()
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.03] via-card to-card">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Greeting column */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {dateStr}
            </p>
            <Badge tone="primary" size="sm">
              {role}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {prompts.length === 0
              ? "You're all caught up. Enjoy the calm."
              : prompts.length === 1
                ? 'One item needs your attention.'
                : `${prompts.length} items need your attention.`}
          </p>
        </div>

        {/* Action prompts column */}
        <div className="flex w-full flex-col gap-2 lg:w-[360px] lg:shrink-0">
          {prompts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-900">
                  All clear
                </p>
                <p className="text-xs text-emerald-700/80">
                  No overdue tasks, all updates submitted, no pending approvals.
                </p>
              </div>
            </div>
          ) : (
            prompts.map((p) => {
              const Icon = p.icon
              const s = toneStyles[p.tone]
              return (
                <Link
                  key={p.key}
                  href={p.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm',
                    s.bg,
                    s.border
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      s.icon
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold', s.text)}>
                      {p.message}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold transition-transform group-hover:translate-x-0.5',
                      s.text
                    )}
                  >
                    {p.cta}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </Card>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
