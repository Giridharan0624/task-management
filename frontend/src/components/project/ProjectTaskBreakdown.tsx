'use client'

import { AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { ProjectStatus, TaskProgress } from '@/lib/api/projectApi'
import { cn } from '@/lib/utils'

interface ProjectTaskBreakdownProps {
  status: ProjectStatus
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-destructive',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-muted-foreground/40',
}

const PRIORITY_TEXT: Record<string, string> = {
  HIGH: 'text-destructive',
  MEDIUM: 'text-amber-700',
  LOW: 'text-muted-foreground',
}

export function ProjectTaskBreakdown({ status }: ProjectTaskBreakdownProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold text-foreground">Task breakdown</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {status.taskProgress.length} task
          {status.taskProgress.length === 1 ? '' : 's'}
        </span>
      </div>
      {status.taskProgress.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No tasks yet"
            description="Add tasks to this project to see progress here."
            className="border-0 py-6"
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[90px]">Priority</TableHead>
              <TableHead className="w-[90px]">Time</TableHead>
              <TableHead className="w-[140px] text-right">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status.taskProgress.map((t) => (
              <TaskRow key={t.taskId} task={t} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function TaskRow({ task }: { task: TaskProgress }) {
  const labelOf = useStatusLabel()
  const statusLabel = labelOf(task.status) || task.status.replace(/_/g, ' ')

  const progressColor =
    task.statusProgress >= 100
      ? 'text-emerald-600'
      : task.statusProgress >= 50
        ? 'text-primary'
        : task.statusProgress >= 15
          ? 'text-blue-600'
          : 'text-muted-foreground'

  return (
    <TableRow className={cn(task.isOverdue && 'bg-destructive/5')}>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {task.title}
          </p>
          {task.isOverdue && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive ring-1 ring-inset ring-destructive/20">
              <AlertCircle className="h-2.5 w-2.5" />
              Overdue
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs font-medium text-muted-foreground">
          {statusLabel}
        </span>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold',
            PRIORITY_TEXT[task.priority] || 'text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              PRIORITY_DOT[task.priority] || 'bg-muted-foreground/40'
            )}
          />
          {task.priority}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs tabular-nums text-muted-foreground">
          {task.trackedHours > 0 ? formatDuration(task.trackedHours) : '—'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Progress value={task.statusProgress} className="h-1 w-16" />
          <span
            className={cn(
              'w-8 text-right text-[10px] font-bold tabular-nums',
              progressColor
            )}
          >
            {task.statusProgress}%
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}
