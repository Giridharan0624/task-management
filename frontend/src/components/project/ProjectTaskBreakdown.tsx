'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
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

// Numeric rank for priority so it sorts in semantic order rather than
// alphabetical (HIGH > MEDIUM > LOW). Unknown priorities sink to the end.
const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

type SortKey = 'title' | 'status' | 'priority' | 'time' | 'progress'
type SortDir = 'asc' | 'desc'
type GroupKey = 'none' | 'status' | 'priority' | 'overdue'

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'overdue', label: 'Overdue' },
]

// Shared grid layout — header + rows. Defined once so columns can never
// drift out of alignment between header and body.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_120px_100px_90px_140px] items-center gap-3'

function sortValue(t: TaskProgress, key: SortKey): number | string {
  switch (key) {
    case 'title':
      return t.title.toLowerCase()
    case 'status':
      return t.status.toLowerCase()
    case 'priority':
      return PRIORITY_RANK[t.priority] ?? 99
    case 'time':
      return t.trackedHours ?? 0
    case 'progress':
      return t.statusProgress ?? 0
  }
}

export function ProjectTaskBreakdown({ status }: ProjectTaskBreakdownProps) {
  const labelOf = useStatusLabel()

  // Default sort: keep the natural ordering most users expect — overdue
  // tasks at the top, then by progress descending so half-done items
  // float above untouched ones.
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [groupBy, setGroupBy] = useState<GroupKey>('none')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Smart default direction per column type.
      setSortDir(key === 'title' || key === 'status' ? 'asc' : 'desc')
    }
  }

  const sortedTasks = useMemo(() => {
    const out = [...status.taskProgress]
    const factor = sortDir === 'asc' ? 1 : -1
    out.sort((a, b) => {
      // Always lift overdue tasks to the top within any sort — surfacing
      // urgency wins over the user's column choice.
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -1 * factor
      if (av > bv) return 1 * factor
      return 0
    })
    return out
  }, [status.taskProgress, sortKey, sortDir])

  // Grouped projection. Date sort within group preserves the parent
  // sort, so a group's rows still respect the active column.
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, TaskProgress[]>()
    for (const t of sortedTasks) {
      const key =
        groupBy === 'status'
          ? labelOf(t.status) || t.status
          : groupBy === 'priority'
            ? t.priority || 'NONE'
            : t.isOverdue
              ? 'Overdue'
              : 'On track'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    const groups = Array.from(map.entries()).map(([key, rows]) => ({
      key,
      rows,
      totalHours: rows.reduce((s, r) => s + (r.trackedHours ?? 0), 0),
    }))
    // Stable group ordering: Overdue first; priority by rank;
    // status alphabetical.
    groups.sort((a, b) => {
      if (groupBy === 'priority')
        return (PRIORITY_RANK[a.key] ?? 99) - (PRIORITY_RANK[b.key] ?? 99)
      if (groupBy === 'overdue')
        return a.key === 'Overdue' ? -1 : b.key === 'Overdue' ? 1 : 0
      return a.key.localeCompare(b.key)
    })
    return groups
  }, [sortedTasks, groupBy, labelOf])

  const totalTracked = status.taskProgress.reduce(
    (s, t) => s + (t.trackedHours ?? 0),
    0,
  )

  return (
    <Card className="overflow-hidden p-0">
      {/* Header — title + group-by pills + summary */}
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-foreground">Task breakdown</h3>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {status.taskProgress.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            <span className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Group
            </span>
            {GROUP_OPTIONS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGroupBy(g.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  groupBy === g.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          {totalTracked > 0 && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatDuration(totalTracked)}
              </span>{' '}
              tracked
            </p>
          )}
        </div>
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
        <div className="overflow-hidden">
          {/* Sticky sortable header */}
          <div
            className={cn(
              ROW_GRID,
              'sticky top-0 z-10 border-b border-border/60 bg-muted/40 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground',
            )}
          >
            <SortHeader
              label="Task"
              keyName="title"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
            />
            <SortHeader
              label="Status"
              keyName="status"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
            />
            <SortHeader
              label="Priority"
              keyName="priority"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
            />
            <SortHeader
              label="Time"
              keyName="time"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
            />
            <SortHeader
              label="Progress"
              keyName="progress"
              sortKey={sortKey}
              sortDir={sortDir}
              onClick={toggleSort}
              align="right"
            />
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {groupBy === 'none' || !grouped ? (
              <div className="divide-y divide-border/60">
                {sortedTasks.map((t) => (
                  <TaskRow key={t.taskId} task={t} statusLabel={labelOf} />
                ))}
              </div>
            ) : (
              grouped.map((g) => (
                <TaskGroup
                  key={g.key}
                  label={g.key}
                  rows={g.rows}
                  totalHours={g.totalHours}
                  statusLabel={labelOf}
                />
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

interface SortHeaderProps {
  label: string
  keyName: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (k: SortKey) => void
  align?: 'left' | 'right'
}

function SortHeader({
  label,
  keyName,
  sortKey,
  sortDir,
  onClick,
  align = 'left',
}: SortHeaderProps) {
  const active = sortKey === keyName
  return (
    <button
      type="button"
      onClick={() => onClick(keyName)}
      className={cn(
        'flex items-center gap-1 transition-colors hover:text-foreground',
        align === 'right' && 'justify-end',
        active && 'text-foreground',
      )}
    >
      {label}
      {active &&
        (sortDir === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  )
}

interface TaskRowProps {
  task: TaskProgress
  /** Pass the resolver in from the parent so each row doesn't re-call
   *  the hook independently — keeps the row a pure render function. */
  statusLabel: (s: string) => string
}

function TaskRow({ task, statusLabel }: TaskRowProps) {
  const label = statusLabel(task.status) || task.status.replace(/_/g, ' ')

  const progressColor =
    task.statusProgress >= 100
      ? 'text-emerald-600'
      : task.statusProgress >= 50
        ? 'text-primary'
        : task.statusProgress >= 15
          ? 'text-blue-600'
          : 'text-muted-foreground'

  return (
    <div
      className={cn(
        ROW_GRID,
        'px-5 py-2.5 text-[12px] transition-colors hover:bg-muted/30',
        task.isOverdue && 'bg-destructive/5',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-semibold',
          PRIORITY_TEXT[task.priority] || 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            PRIORITY_DOT[task.priority] || 'bg-muted-foreground/40',
          )}
        />
        {task.priority}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {task.trackedHours > 0 ? formatDuration(task.trackedHours) : '—'}
      </span>
      <div className="flex items-center justify-end gap-2">
        <Progress value={task.statusProgress} className="h-1 w-16" />
        <span
          className={cn(
            'w-8 text-right text-[10px] font-bold tabular-nums',
            progressColor,
          )}
        >
          {task.statusProgress}%
        </span>
      </div>
    </div>
  )
}

interface TaskGroupProps {
  label: string
  rows: TaskProgress[]
  totalHours: number
  statusLabel: (s: string) => string
}

function TaskGroup({ label, rows, totalHours, statusLabel }: TaskGroupProps) {
  const [open, setOpen] = useState(true)
  const overdueCount = rows.filter((r) => r.isOverdue).length

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-muted/20 px-5 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
            !open && '-rotate-90',
          )}
        />
        <span className="truncate text-[12px] font-bold text-foreground">
          {label}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
        {overdueCount > 0 && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-destructive ring-1 ring-inset ring-destructive/20">
            {overdueCount} overdue
          </span>
        )}
        {totalHours > 0 && (
          <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-foreground">
            {formatDuration(totalHours)}
          </span>
        )}
      </button>
      {open && (
        <div className="divide-y divide-border/60">
          {rows.map((t) => (
            <TaskRow key={t.taskId} task={t} statusLabel={statusLabel} />
          ))}
        </div>
      )}
    </div>
  )
}
