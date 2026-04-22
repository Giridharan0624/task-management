'use client'

import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Sparkline } from '@/components/ui/Sparkline'
import { LiveDot } from '@/components/ui/LiveDot'
import { formatDuration } from '@/lib/utils/formatDuration'
import { cn } from '@/lib/utils'

export interface MemberAttendanceSummary {
  userId: string
  name: string
  email: string
  role: string
  avatarUrl?: string
  totalHours: number
  daysWorked: number
  sessionsCount: number
  avgPerDay: number
  /** Array of hours per day of the selected month (length = days in month) */
  dailyHours: number[]
  /** Whether the member currently has an open session */
  isActive: boolean
  topTask?: { name: string; hours: number; project: string }
}

interface MemberAttendanceCardProps {
  member: MemberAttendanceSummary
  onClick: () => void
  /** Percentage of the team's total hours (0-100) for the comparative bar */
  sharePercent?: number
}

const ROLE_PILL: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  MEMBER: 'bg-blue-100 text-blue-700',
}

export function MemberAttendanceCard({
  member,
  onClick,
  sharePercent,
}: MemberAttendanceCardProps) {
  const rolePill = ROLE_PILL[member.role] || 'bg-muted text-muted-foreground'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all pressable',
        'hover:-translate-y-0.5 hover:border-border/70 hover:shadow-card-hover',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
      )}
    >
      {/* Header row: avatar + name + role + active indicator */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar url={member.avatarUrl} name={member.name} size="md" />
          {member.isActive && (
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
              <LiveDot size="sm" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
            {member.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                rolePill
              )}
            >
              {member.role}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {member.email}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>

      {/* Big total + sparkline */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {formatDuration(member.totalHours)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Total this month
          </p>
        </div>
        {member.dailyHours.length > 1 && (
          <Sparkline
            data={member.dailyHours}
            color={member.isActive ? '#10b981' : 'rgb(var(--color-primary))'}
            height={36}
            width={100}
            className="shrink-0"
          />
        )}
      </div>

      {/* Metadata line */}
      <div className="flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {member.daysWorked}
          </span>{' '}
          day{member.daysWorked === 1 ? '' : 's'}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {member.sessionsCount}
          </span>{' '}
          session{member.sessionsCount === 1 ? '' : 's'}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {formatDuration(member.avgPerDay)}
          </span>{' '}
          / day
        </span>
      </div>

      {/* Top task */}
      {member.topTask && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Top
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {member.topTask.name}
          </span>
          <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
            {formatDuration(member.topTask.hours)}
          </span>
        </div>
      )}

      {/* Share bar — only shown when comparison makes sense */}
      {typeof sharePercent === 'number' && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="shrink-0 uppercase tracking-wider">Share</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70 transition-all"
              style={{ width: `${Math.min(sharePercent, 100)}%` }}
            />
          </div>
          <span className="w-8 text-right font-semibold tabular-nums">
            {sharePercent}%
          </span>
        </div>
      )}
    </button>
  )
}
