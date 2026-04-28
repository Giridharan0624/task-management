'use client'

import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { ProjectStatus } from '@/lib/api/projectApi'
import { cn } from '@/lib/utils'

interface ProjectHealthCardProps {
  status: ProjectStatus
}

const HEALTH_STYLES: Record<
  string,
  { ring: string; bg: string; text: string; dot: string; label: string }
> = {
  COMPLETED: {
    ring: '#10b981',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  ON_TRACK: {
    ring: '#22c55e',
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'On track',
  },
  AT_RISK: {
    ring: '#f59e0b',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'At risk',
  },
  BEHIND: {
    ring: '#ef4444',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Behind',
  },
}

export function ProjectHealthCard({ status }: ProjectHealthCardProps) {
  const hc = HEALTH_STYLES[status.health] ?? HEALTH_STYLES.ON_TRACK
  const ringColor = hc.ring

  return (
    <Card className="p-5">
      <div className="flex items-center gap-5 mb-5">
        <div
          className="relative shrink-0"
          style={{ width: 80, height: 80 }}
          role="img"
          aria-label={`Overall score ${status.overallScore} percent`}
        >
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeDasharray={`${status.overallScore} ${100 - status.overallScore}`}
              strokeLinecap="round"
              pathLength={100}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-foreground">
              {status.overallScore}%
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[13px] font-bold text-foreground">
            Overall score
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold',
              hc.bg,
              hc.text
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', hc.dot)} />
            {hc.label}
          </span>
          {status.overdueCount > 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-destructive">
              {status.overdueCount} overdue task
              {status.overdueCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Metric
          label="Completion"
          value={`${status.completionPercent}%`}
          progress={status.completionPercent}
          tone={
            status.completionPercent >= 100
              ? 'bg-emerald-500'
              : 'bg-primary'
          }
        />
        {/* "Time budget" + "/ {estimate}" suffix removed: tasks do not
            collect an estimated-hours value through the UI today, so
            the percentage compared against an unset budget is
            meaningless. If estimates are added back to the create/
            edit task form, restore both the Metric and the suffix. */}
        {status.totalTrackedHours > 0 && (
          <div className="flex items-center justify-between pt-1 text-[11px]">
            <span className="text-muted-foreground">Time tracked</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatDuration(status.totalTrackedHours)}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

function Metric({
  label,
  value,
  progress,
  tone,
}: {
  label: string
  value: string
  progress: number
  tone: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}

export function ProjectTaskCounts({ status }: { status: ProjectStatus }) {
  const doneCount = status.taskCounts?.DONE ?? 0
  const todoCount = status.taskCounts?.TODO ?? 0
  const activeCount = (status.totalTasks ?? 0) - todoCount - doneCount
  const overdue = status.overdueCount

  return (
    <Card className="p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Task counts
      </p>
      <div className="grid grid-cols-2 gap-3">
        <CountTile
          label="To do"
          value={todoCount}
          bg="bg-amber-50 border-amber-200"
          text="text-amber-700"
        />
        <CountTile
          label="Active"
          value={activeCount}
          bg="bg-blue-50 border-blue-200"
          text="text-blue-700"
        />
        <CountTile
          label="Done"
          value={doneCount}
          bg="bg-emerald-50 border-emerald-200"
          text="text-emerald-700"
        />
        <CountTile
          label="Overdue"
          value={overdue}
          bg={
            overdue > 0
              ? 'bg-destructive/5 border-destructive/30'
              : 'bg-muted/40 border-border'
          }
          text={overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}
        />
      </div>
    </Card>
  )
}

function CountTile({
  label,
  value,
  bg,
  text,
}: {
  label: string
  value: number
  bg: string
  text: string
}) {
  return (
    <div className={cn('rounded-xl border px-4 py-3.5', bg)}>
      <p className={cn('text-2xl font-bold tabular-nums', text)}>{value}</p>
      <p className={cn('mt-0.5 text-[10px] font-semibold opacity-80', text)}>
        {label}
      </p>
    </div>
  )
}
