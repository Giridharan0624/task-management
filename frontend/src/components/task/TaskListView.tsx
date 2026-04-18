'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  KanbanSquare,
  AlertCircle,
  CalendarClock,
  Folder,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { getProjectColor } from '@/lib/utils/projectColor'
import { parseDeadline, isOverdue as checkOverdue } from '@/lib/utils/deadline'
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABEL,
  getStatusProgress,
  type TaskDomain,
} from '@/types/task'
import type { MyTask } from '@/lib/api/userApi'
import type { GroupBy } from './TaskToolbar'
import { cn } from '@/lib/utils'

interface TaskListViewProps {
  tasks: MyTask[]
  groupBy: GroupBy
  showAssignee: boolean
  resolveName: (userId: string) => string
  onSelectTask: (task: MyTask) => void
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

interface TaskGroup {
  key: string
  label: string
  sublabel?: string
  icon?: React.ReactNode
  accent?: string
  tasks: MyTask[]
}

export function TaskListView({
  tasks,
  groupBy,
  showAssignee,
  resolveName,
  onSelectTask,
}: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks match your filters"
        description="Try clearing filters or switching scope to see more tasks."
      />
    )
  }

  if (groupBy === 'none') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <TaskTableHeader showAssignee={showAssignee} />
        <ul className="divide-y divide-border/60">
          {tasks.map((task) => (
            <TaskRow
              key={task.taskId}
              task={task}
              showAssignee={showAssignee}
              resolveName={resolveName}
              onSelect={() => onSelectTask(task)}
            />
          ))}
        </ul>
      </div>
    )
  }

  const groups = groupTasks(tasks, groupBy)

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.key}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
          <GroupHeader group={group} />
          <TaskTableHeader showAssignee={showAssignee} />
          <ul className="divide-y divide-border/60">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                showAssignee={showAssignee}
                resolveName={resolveName}
                onSelect={() => onSelectTask(task)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TaskTableHeader({ showAssignee }: { showAssignee: boolean }) {
  return (
    <div
      className={cn(
        'hidden md:grid items-center gap-4 border-b border-border/60 bg-muted/30 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
        showAssignee
          ? 'grid-cols-[minmax(0,1fr)_140px_120px_100px_70px]'
          : 'grid-cols-[minmax(0,1fr)_120px_100px_70px]'
      )}
    >
      <span>Task</span>
      {showAssignee && <span>Assignee</span>}
      <span>Status</span>
      <span>Deadline</span>
      <span className="text-right">Priority</span>
    </div>
  )
}

function TaskRow({
  task,
  showAssignee,
  resolveName,
  onSelect,
}: {
  task: MyTask
  showAssignee: boolean
  resolveName: (userId: string) => string
  onSelect: () => void
}) {
  const overdue = checkOverdue(task.deadline, task.status)
  const pct = getStatusProgress(
    task.status,
    (task.domain as TaskDomain) || 'DEVELOPMENT'
  )

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group relative block cursor-pointer transition-colors hover:bg-muted/30',
        // Grid on md+
        'md:grid md:items-center md:gap-4 md:px-5 md:py-3',
        showAssignee
          ? 'md:grid-cols-[minmax(0,1fr)_140px_120px_100px_70px]'
          : 'md:grid-cols-[minmax(0,1fr)_120px_100px_70px]'
      )}
    >
      {/* Mobile: stacked card */}
      <div className="flex flex-col gap-1.5 p-4 md:hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">
            {task.title}
          </p>
          <Badge className={PRIORITY_COLORS[task.priority]}>
            {task.priority}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Folder className="h-3 w-3" />
          <span className="truncate">{task.projectName}</span>
          <span aria-hidden>·</span>
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
              TASK_STATUS_COLORS[task.status] ||
                'bg-muted text-muted-foreground'
            )}
          >
            {TASK_STATUS_LABEL[task.status] ?? task.status}
          </span>
          {task.deadline && (
            <>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  overdue ? 'text-destructive font-semibold' : ''
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {new Date(task.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:block min-w-0">
        <div className="flex items-center gap-2">
          {overdue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>Overdue</TooltipContent>
            </Tooltip>
          )}
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {task.title}
          </p>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Folder className="h-3 w-3" />
          <span className="truncate">{task.projectName}</span>
        </p>
      </div>

      {showAssignee && (
        <div className="hidden md:flex flex-wrap gap-1">
          {(task.assignedTo ?? []).slice(0, 2).map((uid) => (
            <span
              key={uid}
              className="inline-flex max-w-[100px] items-center truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {resolveName(uid)}
            </span>
          ))}
          {(task.assignedTo ?? []).length > 2 && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              +{(task.assignedTo ?? []).length - 2}
            </span>
          )}
        </div>
      )}

      <div className="hidden md:block">
        <span
          className={cn(
            'inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold',
            TASK_STATUS_COLORS[task.status] || 'bg-muted text-muted-foreground'
          )}
        >
          {TASK_STATUS_LABEL[task.status] ?? task.status}
        </span>
      </div>

      <div className="hidden md:block">
        <span
          className={cn(
            'text-xs',
            overdue
              ? 'font-semibold text-destructive'
              : 'text-muted-foreground'
          )}
        >
          {task.deadline
            ? new Date(task.deadline).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : '—'}
        </span>
      </div>

      <div className="hidden md:flex justify-end">
        <Badge className={PRIORITY_COLORS[task.priority]}>
          {task.priority}
        </Badge>
      </div>

      {/* Progress bar on hover (desktop only) */}
      <div className="hidden md:block absolute inset-x-5 bottom-1 h-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Progress value={pct} className="h-0.5" />
      </div>
    </li>
  )
}

function GroupHeader({ group }: { group: TaskGroup }) {
  const done = group.tasks.filter((t) => t.status === 'DONE').length
  const pct =
    group.tasks.length > 0 ? Math.round((done / group.tasks.length) * 100) : 0
  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {group.icon ? (
          group.icon
        ) : (
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white',
              group.accent || 'bg-muted-foreground'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">
            {group.label}
          </h3>
          {group.sublabel && (
            <p className="text-[10px] font-medium text-muted-foreground">
              {group.sublabel}
            </p>
          )}
        </div>
      </div>
      <div className="flex min-w-[100px] items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {done}/{group.tasks.length}
        </span>
        <Progress value={pct} className="w-16 h-1.5" />
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
    </div>
  )
}

function groupTasks(tasks: MyTask[], groupBy: GroupBy): TaskGroup[] {
  const map = new Map<string, TaskGroup>()

  for (const t of tasks) {
    const keys = getGroupKey(t, groupBy)
    for (const { key, label, sublabel, icon, accent } of keys) {
      if (!map.has(key)) {
        map.set(key, { key, label, sublabel, icon, accent, tasks: [] })
      }
      map.get(key)!.tasks.push(t)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (groupBy === 'priority') {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>
      return (order[a.key] ?? 99) - (order[b.key] ?? 99)
    }
    if (groupBy === 'status') {
      const dead = a.key === 'DONE' ? 1 : 0
      const bDead = b.key === 'DONE' ? 1 : 0
      return dead - bDead || a.label.localeCompare(b.label)
    }
    if (groupBy === 'deadline') {
      return a.key.localeCompare(b.key)
    }
    return b.tasks.length - a.tasks.length
  })
}

function getGroupKey(
  task: MyTask,
  groupBy: GroupBy
): { key: string; label: string; sublabel?: string; icon?: React.ReactNode; accent?: string }[] {
  switch (groupBy) {
    case 'project':
      return [
        {
          key: task.projectId,
          label: task.projectName || 'Direct tasks',
          accent: `bg-gradient-to-br ${getProjectColor(task.projectName || 'direct')}`,
        },
      ]
    case 'status':
      return [
        {
          key: task.status,
          label: TASK_STATUS_LABEL[task.status] ?? task.status,
          accent:
            task.status === 'DONE'
              ? 'bg-emerald-500'
              : task.status === 'TODO'
                ? 'bg-amber-500'
                : 'bg-blue-500',
        },
      ]
    case 'priority':
      return [
        {
          key: task.priority,
          label:
            task.priority[0] + task.priority.slice(1).toLowerCase() +
            ' priority',
          accent:
            task.priority === 'HIGH'
              ? 'bg-red-500'
              : task.priority === 'MEDIUM'
                ? 'bg-amber-500'
                : 'bg-slate-400',
        },
      ]
    case 'assignee': {
      if (!task.assignedTo || task.assignedTo.length === 0) {
        return [{ key: '__unassigned', label: 'Unassigned', accent: 'bg-muted-foreground' }]
      }
      return task.assignedTo.map((uid) => ({
        key: uid,
        label: uid,
        sublabel: 'Assignee',
      }))
    }
    case 'deadline': {
      const bucket = deadlineBucket(task.deadline, task.status)
      return [
        {
          key: bucket.key,
          label: bucket.label,
          accent: bucket.accent,
        },
      ]
    }
    default:
      return [{ key: 'all', label: 'All' }]
  }
}

function deadlineBucket(
  deadline: string,
  status: string
): { key: string; label: string; accent: string } {
  if (!deadline) {
    return { key: '99_none', label: 'No deadline', accent: 'bg-muted-foreground' }
  }
  if (checkOverdue(deadline, status)) {
    return { key: '01_overdue', label: 'Overdue', accent: 'bg-destructive' }
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dl = parseDeadline(deadline)
  const dlDate = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate())
  const days = Math.round(
    (dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days === 0) return { key: '02_today', label: 'Due today', accent: 'bg-red-500' }
  if (days === 1) return { key: '03_tomorrow', label: 'Due tomorrow', accent: 'bg-amber-500' }
  if (days <= 7) return { key: '04_week', label: 'Due this week', accent: 'bg-amber-400' }
  if (days <= 30) return { key: '05_month', label: 'Due this month', accent: 'bg-blue-500' }
  return { key: '06_later', label: 'Later', accent: 'bg-slate-400' }
}

// Escape hatch for consumers that want the raw icons/types
export { KanbanSquare as _KanbanIcon, type LucideIcon }
