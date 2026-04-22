'use client'

import * as React from 'react'
import Link from 'next/link'
import { useState } from 'react'
import {
  KanbanSquare,
  AlertCircle,
  ChevronDown,
  Folder,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/Checkbox'
import { DeadlineLabel } from '@/components/ui/DeadlineLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { usePrefetchTask } from '@/lib/hooks/usePrefetchTask'
import { useValueFlash } from '@/lib/hooks/useValueFlash'
import { getProjectColor } from '@/lib/utils/projectColor'
import { parseDeadline, isOverdue as checkOverdue } from '@/lib/utils/deadline'
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABEL,
  getStatusProgress,
  type TaskDomain,
} from '@/types/task'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import type { MyTask } from '@/lib/api/userApi'
import type { GroupBy } from './TaskToolbar'
import { cn } from '@/lib/utils'

interface TaskListViewProps {
  tasks: MyTask[]
  groupBy: GroupBy
  showAssignee: boolean
  resolveName: (userId: string) => string
  onSelectTask: (task: MyTask) => void
  /** Optional multi-select — when passed, a checkbox column is shown. */
  selection?: {
    isSelected: (taskId: string) => boolean
    toggle: (taskId: string) => void
    selectAll: (taskIds: string[]) => void
    isAllSelected: (taskIds: string[]) => boolean
  }
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
  selection,
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
    const ids = tasks.map((t) => t.taskId)
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <TaskTableHeader
          showAssignee={showAssignee}
          selection={
            selection
              ? {
                  isAllSelected: selection.isAllSelected(ids),
                  onToggleAll: () => selection.selectAll(ids),
                }
              : undefined
          }
        />
        <ul className="divide-y divide-border/60 stagger-up">
          {tasks.map((task) => (
            <TaskRow
              key={task.taskId}
              task={task}
              showAssignee={showAssignee}
              resolveName={resolveName}
              onSelect={() => onSelectTask(task)}
              selection={
                selection
                  ? {
                      isSelected: selection.isSelected(task.taskId),
                      toggle: () => selection.toggle(task.taskId),
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      </div>
    )
  }

  const groups = groupTasks(tasks, groupBy, resolveName)

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <CollapsibleGroup
          key={group.key}
          group={group}
          showAssignee={showAssignee}
          resolveName={resolveName}
          onSelectTask={onSelectTask}
          selection={selection}
        />
      ))}
    </div>
  )
}

function CollapsibleGroup({
  group,
  showAssignee,
  resolveName,
  onSelectTask,
  selection,
}: {
  group: TaskGroup
  showAssignee: boolean
  resolveName: (userId: string) => string
  onSelectTask: (task: MyTask) => void
  selection?: TaskListViewProps['selection']
}) {
  // Default expanded — collapsing is opt-in so users don't have to re-open
  // every project group on first paint. State is per-group so toggling
  // one doesn't move the others.
  const [expanded, setExpanded] = useState(true)
  const groupIds = group.tasks.map((t) => t.taskId)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <GroupHeader
        group={group}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <div className="animate-fade-in" style={{ animationDuration: '0.15s' }}>
          <TaskTableHeader
            showAssignee={showAssignee}
            selection={
              selection
                ? {
                    isAllSelected: selection.isAllSelected(groupIds),
                    onToggleAll: () => selection.selectAll(groupIds),
                  }
                : undefined
            }
          />
          <ul className="divide-y divide-border/60 stagger-up">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                showAssignee={showAssignee}
                resolveName={resolveName}
                onSelect={() => onSelectTask(task)}
                selection={
                  selection
                    ? {
                        isSelected: selection.isSelected(task.taskId),
                        toggle: () => selection.toggle(task.taskId),
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TaskTableHeader({
  showAssignee,
  selection,
}: {
  showAssignee: boolean
  selection?: { isAllSelected: boolean; onToggleAll: () => void }
}) {
  const gridCols = selection
    ? showAssignee
      ? 'grid-cols-[28px_minmax(0,1fr)_140px_120px_100px_70px]'
      : 'grid-cols-[28px_minmax(0,1fr)_120px_100px_70px]'
    : showAssignee
      ? 'grid-cols-[minmax(0,1fr)_140px_120px_100px_70px]'
      : 'grid-cols-[minmax(0,1fr)_120px_100px_70px]'
  return (
    <div
      className={cn(
        'hidden md:grid items-center gap-4 border-b border-border/60 bg-muted/30 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
        gridCols
      )}
    >
      {selection && (
        <Checkbox
          checked={selection.isAllSelected}
          onCheckedChange={selection.onToggleAll}
          aria-label="Select all tasks"
        />
      )}
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
  selection,
}: {
  task: MyTask
  showAssignee: boolean
  resolveName: (userId: string) => string
  onSelect: () => void
  selection?: { isSelected: boolean; toggle: () => void }
}) {
  const labelOf = useStatusLabel()
  const overdue = checkOverdue(task.deadline, task.status)
  const pct = getStatusProgress(
    task.status,
    (task.domain as TaskDomain) || 'DEVELOPMENT'
  )
  const prefetchTask = usePrefetchTask()
  const statusFlash = useValueFlash(task.status)

  const gridCols = selection
    ? showAssignee
      ? 'md:grid-cols-[28px_minmax(0,1fr)_140px_120px_100px_70px]'
      : 'md:grid-cols-[28px_minmax(0,1fr)_120px_100px_70px]'
    : showAssignee
      ? 'md:grid-cols-[minmax(0,1fr)_140px_120px_100px_70px]'
      : 'md:grid-cols-[minmax(0,1fr)_120px_100px_70px]'

  return (
    <li
      role="button"
      tabIndex={0}
      aria-selected={selection?.isSelected}
      onClick={onSelect}
      onMouseEnter={() => prefetchTask(task.projectId, task.taskId)}
      onFocus={() => prefetchTask(task.projectId, task.taskId)}
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
        gridCols,
        selection?.isSelected && 'bg-primary/5'
      )}
    >
      {selection && (
        <div
          className="hidden md:flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selection.isSelected}
            onCheckedChange={selection.toggle}
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}
      {/* Mobile: stacked card */}
      <div className="flex gap-3 p-4 md:hidden">
        {selection && (
          <div
            className="pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selection.isSelected}
              onCheckedChange={selection.toggle}
              aria-label={`Select ${task.title}`}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
            {labelOf(task.status)}
          </span>
          {task.deadline && (
            <>
              <span aria-hidden>·</span>
              <DeadlineLabel
                deadline={task.deadline}
                status={task.status}
                icon
                compact
              />
            </>
          )}
        </div>
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
            TASK_STATUS_COLORS[task.status] || 'bg-muted text-muted-foreground',
            statusFlash
          )}
        >
          {labelOf(task.status)}
        </span>
      </div>

      <div className="hidden md:block text-xs">
        {task.deadline ? (
          <DeadlineLabel
            deadline={task.deadline}
            status={task.status}
            compact
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
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

function GroupHeader({
  group,
  expanded,
  onToggle,
}: {
  group: TaskGroup
  expanded?: boolean
  onToggle?: () => void
}) {
  const done = group.tasks.filter((t) => t.status === 'DONE').length
  const pct =
    group.tasks.length > 0 ? Math.round((done / group.tasks.length) * 100) : 0
  // Whole header becomes the toggle when a handler is provided. Falls back
  // to a plain div when used outside a CollapsibleGroup.
  const interactive = typeof onToggle === 'function'

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {interactive && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded ? 'rotate-0' : '-rotate-90'
            )}
          />
        )}
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
    </>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse group' : 'Expand group'}
        className="flex w-full cursor-pointer items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {body}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
      {body}
    </div>
  )
}

function groupTasks(
  tasks: MyTask[],
  groupBy: GroupBy,
  resolveName: (userId: string) => string,
): TaskGroup[] {
  const map = new Map<string, TaskGroup>()

  for (const t of tasks) {
    const keys = getGroupKey(t, groupBy, resolveName)
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
  groupBy: GroupBy,
  resolveName: (userId: string) => string,
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
        // Fall back to the raw id only when we can't resolve — for
        // example a user who was deleted after being assigned. That
        // edge case is rare; preferring the name the user actually
        // recognises is worth it.
        label: resolveName(uid) || uid,
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
