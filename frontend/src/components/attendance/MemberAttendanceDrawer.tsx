'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Progress } from '@/components/ui/Progress'
import { LiveDot } from '@/components/ui/LiveDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import type { Attendance } from '@/types/attendance'
import type { MemberAttendanceSummary } from './MemberAttendanceCard'
import { cn } from '@/lib/utils'

interface MemberAttendanceDrawerProps {
  open: boolean
  onClose: () => void
  member: MemberAttendanceSummary | null
  /** All attendance records for this member in the selected month */
  records: Attendance[]
  monthLabel: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function MemberAttendanceDrawer({
  open,
  onClose,
  member,
  records,
  monthLabel,
}: MemberAttendanceDrawerProps) {
  const taskStats = useMemo(() => {
    if (!member) return []
    const map = new Map<
      string,
      {
        taskTitle: string
        projectName: string
        hours: number
        sessions: number
      }
    >()
    for (const r of records) {
      for (const s of r.sessions) {
        const key = `${s.taskTitle || 'General'}::${s.projectName || '-'}`
        const hrs = getSessionHours(s)
        const ex = map.get(key)
        if (ex) {
          ex.hours += hrs
          ex.sessions += 1
        } else {
          map.set(key, {
            taskTitle: s.taskTitle || 'General',
            projectName: s.projectName || '-',
            hours: hrs,
            sessions: 1,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [records, member])

  const totalHoursOfTasks = taskStats.reduce((s, t) => s + t.hours, 0)

  const sortedDaily = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records]
  )

  if (!member) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-y-auto p-0">
        {/* Hero header */}
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar url={member.avatarUrl} name={member.name} size="lg" />
              {member.isActive && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
                  <LiveDot size="md" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle>{member.name}</DialogTitle>
              <DialogDescription>
                {member.role} · {member.email}
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {monthLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatTile
              value={formatDuration(member.totalHours)}
              label="Total"
              accent="text-primary"
            />
            <StatTile
              value={member.daysWorked}
              label="Days"
              accent="text-foreground"
            />
            <StatTile
              value={member.sessionsCount}
              label="Sessions"
              accent="text-violet-700"
            />
            <StatTile
              value={formatDuration(member.avgPerDay)}
              label="Avg/day"
              accent="text-emerald-700"
            />
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          <Tabs defaultValue="daily" className="w-full">
            <TabsList>
              <TabsTrigger value="daily" className="gap-2">
                Daily
                <TabCount>{sortedDaily.length}</TabCount>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                Tasks
                <TabCount>{taskStats.length}</TabCount>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="mt-4">
              {sortedDaily.length === 0 ? (
                <EmptyState
                  title="No sessions"
                  description="This member did not clock in during this month."
                  className="border-0 py-6"
                />
              ) : (
                <div className="space-y-3">
                  {sortedDaily.map((r) => {
                    const hours = r.sessions.reduce(
                      (s, se) => s + getSessionHours(se),
                      0
                    )
                    const anyActive = r.sessions.some((s) => !s.signOutAt)
                    return (
                      <div
                        key={r.date}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                      >
                        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2">
                          <span className="min-w-[110px] text-xs font-semibold tabular-nums text-foreground">
                            {formatDateLabel(r.date)}
                          </span>
                          <span className="flex-1 text-[11px] text-muted-foreground">
                            {r.sessions.length} session
                            {r.sessions.length !== 1 ? 's' : ''}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold tabular-nums',
                              anyActive ? 'text-emerald-600' : 'text-primary'
                            )}
                          >
                            {formatDuration(hours)}
                          </span>
                        </div>
                        <ul className="divide-y divide-border/60">
                          {r.sessions.map((s, i) => {
                            const active = !s.signOutAt
                            return (
                              <li key={i} className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                    {active && <LiveDot size="xs" />}
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {s.taskTitle || 'General'}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {s.projectName || '-'}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                                    {formatTime(s.signInAt)} –{' '}
                                    {s.signOutAt
                                      ? formatTime(s.signOutAt)
                                      : 'now'}
                                  </span>
                                  <span
                                    className={cn(
                                      'w-14 shrink-0 text-right text-[11px] font-bold tabular-nums',
                                      active
                                        ? 'text-emerald-600'
                                        : 'text-foreground'
                                    )}
                                  >
                                    {formatDuration(getSessionHours(s))}
                                  </span>
                                </div>
                                {s.description && (
                                  <p className="mt-0.5 pl-0.5 text-[10px] italic text-muted-foreground">
                                    — {s.description}
                                  </p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              {taskStats.length === 0 ? (
                <EmptyState
                  title="No tasks logged"
                  description="This member did not log any task time this month."
                  className="border-0 py-6"
                />
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                  {taskStats.map((t) => {
                    const pct =
                      totalHoursOfTasks > 0
                        ? Math.round((t.hours / totalHoursOfTasks) * 100)
                        : 0
                    return (
                      <li
                        key={`${t.projectName}::${t.taskTitle}`}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {t.taskTitle}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {t.projectName} · {t.sessions} session
                            {t.sessions === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex w-32 shrink-0 flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                            <span className="text-xs font-bold tabular-nums text-primary">
                              {formatDuration(t.hours)}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1" />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatTile({
  value,
  label,
  accent,
}: {
  value: number | string
  label: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
      <p className={cn('text-sm font-bold tabular-nums', accent)}>{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}
