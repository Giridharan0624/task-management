'use client'

import { useMemo } from 'react'
import { Folder } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DeadlineLabel } from '@/components/ui/DeadlineLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePrefetchTask } from '@/lib/hooks/usePrefetchTask'
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABEL,
  DOMAIN_STATUSES,
} from '@/types/task'
import { parseDeadline, isOverdue as checkOverdue } from '@/lib/utils/deadline'
import type { MyTask } from '@/lib/api/userApi'
import { cn } from '@/lib/utils'
import {
  buildStatusIndex,
  findPipeline,
  usePipelines,
} from '@/lib/tenant/usePipelines'

interface TaskBoardProps {
  tasks: MyTask[]
  onSelectTask: (task: MyTask) => void
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-destructive',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-slate-300',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

/**
 * Cross-project board. Columns derive from the status values actually
 * present in the visible task set (so we don't show empty columns for
 * statuses no task uses).
 *
 * Phase 5: column ordering + status labels/colors come from the tenant's
 * pipelines via usePipelines(). Falls back to the legacy hardcoded
 * DEVELOPMENT pipeline + TASK_STATUS_* constants when pipelines aren't
 * loaded yet (initial render) or when a status isn't in any pipeline
 * (legacy data).
 */
export function TaskBoard({ tasks, onSelectTask }: TaskBoardProps) {
  const { pipelines } = usePipelines()
  const statusIndex = useMemo(() => buildStatusIndex(pipelines), [pipelines])
  const defaultPipeline = useMemo(
    () => findPipeline(pipelines, undefined),
    [pipelines]
  )

  const columns = useMemo(
    () => buildColumns(tasks, defaultPipeline?.statuses.map((s) => s.id) ?? null),
    [tasks, defaultPipeline]
  )

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks match your filters"
        description="Try clearing filters or switching scope to see more tasks."
      />
    )
  }

  return (
    <div className="kanban-scroll -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div
        className="grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-3 stagger-rise"
        style={{ minWidth: `${columns.length * 288}px` }}
      >
        {columns.map((col) => (
          <BoardColumn
            key={col.status}
            column={col}
            statusIndex={statusIndex}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </div>
  )
}

function BoardColumn({
  column,
  statusIndex,
  onSelectTask,
}: {
  column: { status: string; tasks: MyTask[] }
  statusIndex: ReturnType<typeof buildStatusIndex>
  onSelectTask: (task: MyTask) => void
}) {
  // Tenant-defined label/color win; fall back to hardcoded constants for
  // legacy statuses not present in any pipeline.
  const meta = statusIndex.get(column.status)
  const label = meta?.label ?? TASK_STATUS_LABEL[column.status] ?? column.status
  const statusClass = meta
    ? // Inline tenant color via style — Tailwind classes can't reach a
      // dynamic hex. The class still provides padding/rounding/font.
      'bg-muted text-foreground'
    : TASK_STATUS_COLORS[column.status] || 'bg-muted text-muted-foreground'

  return (
    <div className="flex h-full min-h-[200px] flex-col rounded-2xl border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
              statusClass
            )}
            style={
              meta
                ? { backgroundColor: `${meta.color}20`, color: meta.color }
                : undefined
            }
          >
            {label}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {column.tasks.length}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2 stagger-up">
        {column.tasks.map((task) => (
          <BoardCard
            key={task.taskId}
            task={task}
            onClick={() => onSelectTask(task)}
          />
        ))}
      </div>
    </div>
  )
}

function BoardCard({
  task,
  onClick,
}: {
  task: MyTask
  onClick: () => void
}) {
  const prefetchTask = usePrefetchTask()
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => prefetchTask(task.projectId, task.taskId)}
      onFocus={() => prefetchTask(task.projectId, task.taskId)}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pressable"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1 inline-flex h-2 w-2 shrink-0 rounded-full',
            PRIORITY_DOT[task.priority]
          )}
          aria-label={`${task.priority} priority`}
        />
        <p className="line-clamp-2 flex-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {task.title}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Folder className="h-3 w-3" />
        <span className="truncate">{task.projectName}</span>
      </div>
      <div className="flex items-center justify-between">
        {task.deadline ? (
          <DeadlineLabel
            deadline={task.deadline}
            status={task.status}
            compact
            className="text-[10px]"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">No deadline</span>
        )}
        <Badge className={PRIORITY_COLORS[task.priority]}>
          {task.priority}
        </Badge>
      </div>
    </button>
  )
}

function buildColumns(
  tasks: MyTask[],
  preferredOrder: string[] | null,
): { status: string; tasks: MyTask[] }[] {
  const byStatus = new Map<string, MyTask[]>()
  for (const t of tasks) {
    if (!byStatus.has(t.status)) byStatus.set(t.status, [])
    byStatus.get(t.status)!.push(t)
  }

  // Canonical ordering: prefer the tenant's default pipeline order when
  // pipelines have loaded; fall back to the legacy DEVELOPMENT pipeline
  // for the initial render before pipelines arrive. Statuses not present
  // in either are appended alphabetically — keeps legacy data visible.
  const order =
    preferredOrder && preferredOrder.length > 0
      ? preferredOrder
      : (DOMAIN_STATUSES.DEVELOPMENT as readonly string[])
  const ordered: string[] = []
  for (const s of order) if (byStatus.has(s)) ordered.push(s)
  for (const s of Array.from(byStatus.keys()).sort()) {
    if (!ordered.includes(s)) ordered.push(s)
  }

  // Sort each column's tasks: overdue first, then deadline ascending
  for (const [, col] of byStatus) {
    col.sort((a, b) => {
      const aOv = checkOverdue(a.deadline, a.status) ? 1 : 0
      const bOv = checkOverdue(b.deadline, b.status) ? 1 : 0
      if (aOv !== bOv) return bOv - aOv
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return parseDeadline(a.deadline).getTime() - parseDeadline(b.deadline).getTime()
    })
  }

  return ordered.map((s) => ({ status: s, tasks: byStatus.get(s)! }))
}

// Kanban scrollbar styling lives in globals.css under .kanban-scroll; re-using it here.
