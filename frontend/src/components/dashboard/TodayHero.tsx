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

// Tone styles flattened: a single colored leading rule + colored
// label text instead of a tinted card surface + icon chip.
const toneStyles: Record<Tone, { rule: string; text: string; icon: string }> = {
  danger: {
    rule: 'before:bg-destructive',
    text: 'text-destructive',
    icon: 'text-destructive',
  },
  warning: {
    rule: 'before:bg-amber-500',
    text: 'text-amber-700',
    icon: 'text-amber-600',
  },
  info: {
    rule: 'before:bg-primary',
    text: 'text-primary',
    icon: 'text-primary',
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
    <div className="flex flex-col gap-6 border-b border-border/60 pb-6 lg:flex-row lg:items-start lg:gap-10 lg:pb-8">
      {/* Greeting column */}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {dateStr}
          </p>
          <span className="text-[10px] text-muted-foreground/40">·</span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {role}
          </p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {prompts.length === 0
            ? "You're all caught up."
            : prompts.length === 1
              ? '1 item needs your attention.'
              : `${prompts.length} items need your attention.`}
        </p>
      </div>

      {/* Action prompts column — flat list with leading colored rules */}
      <div className="flex w-full flex-col lg:w-[400px] lg:shrink-0">
        {prompts.length === 0 ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Sparkles
              className="h-3.5 w-3.5 text-emerald-600"
              strokeWidth={1.8}
            />
            <span>
              No overdue tasks, all updates submitted, no pending approvals.
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {prompts.map((p) => {
              const Icon = p.icon
              const s = toneStyles[p.tone]
              return (
                <li key={p.key}>
                  <Link
                    href={p.href}
                    className={cn(
                      'group relative flex items-center gap-3 py-2.5 pl-4 pr-1 transition-colors hover:bg-muted/30',
                      'before:absolute before:left-0 before:top-2.5 before:h-[calc(100%-1.25rem)] before:w-px',
                      s.rule,
                    )}
                  >
                    <Icon
                      className={cn('h-3.5 w-3.5 shrink-0', s.icon)}
                      strokeWidth={1.8}
                    />
                    <p className="min-w-0 flex-1 text-sm text-foreground">
                      {p.message}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] transition-transform group-hover:translate-x-0.5',
                        s.text,
                      )}
                    >
                      {p.cta}
                      <ChevronRight className="h-3 w-3" strokeWidth={1.8} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
