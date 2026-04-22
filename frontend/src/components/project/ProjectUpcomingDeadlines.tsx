'use client'

import { Clock, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { parseDeadline } from '@/lib/utils/deadline'
import { DeadlineLabel } from '@/components/ui/DeadlineLabel'
import type { Task } from '@/types/task'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import { cn } from '@/lib/utils'

interface ProjectUpcomingDeadlinesProps {
  tasks: Task[]
}

interface EnrichedDeadline extends Task {
  deadlineDate: Date
}

export function ProjectUpcomingDeadlines({
  tasks,
}: ProjectUpcomingDeadlinesProps) {
  const labelOf = useStatusLabel()
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )

  const upcoming: EnrichedDeadline[] = tasks
    .filter((t) => t.status !== 'DONE' && t.deadline)
    .map((t) => ({ ...t, deadlineDate: parseDeadline(t.deadline) }))
    .filter((t) => {
      const diff =
        (t.deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7
    })
    .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())

  if (upcoming.length === 0) return null

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Clock className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-foreground">Upcoming deadlines</h3>
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 ring-1 ring-inset ring-amber-200">
          {upcoming.length}
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {upcoming.map((t) => {
          const isOverdue = t.deadlineDate < now
          const deadlineDay = new Date(
            t.deadlineDate.getFullYear(),
            t.deadlineDate.getMonth(),
            t.deadlineDate.getDate()
          )
          const diffDays = Math.round(
            (deadlineDay.getTime() - todayStart.getTime()) /
              (1000 * 60 * 60 * 24)
          )
          const dot = isOverdue
            ? 'bg-destructive'
            : diffDays <= 2
              ? 'bg-amber-500'
              : 'bg-blue-500'
          return (
            <li
              key={t.taskId}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5',
                isOverdue && 'bg-destructive/5'
              )}
            >
              {isOverdue ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
              )}
              <p className="flex-1 truncate text-sm font-medium text-foreground">
                {t.title}
              </p>
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                {labelOf(t.status)}
              </span>
              <DeadlineLabel
                deadline={t.deadline}
                status={t.status}
                className="shrink-0 text-[11px] font-semibold"
              />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
