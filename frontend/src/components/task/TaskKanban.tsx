'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  X,
  ChevronRight,
  AlertTriangle,
  Plus,
  ArrowDownUp,
  Flag,
  User,
  Users,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/AvatarUpload'
import { DeadlineLabel } from '@/components/ui/DeadlineLabel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import type { Task, TaskPriority, TaskDomain } from '@/types/task'
import {
  TASK_STATUS_COLORS,
  DOMAIN_STATUSES,
  getStatusOptions,
  getStatusProgress,
} from '@/types/task'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import type { ProjectMember } from '@/types/user'
import type { Permissions } from '@/lib/hooks/usePermission'
import { TaskDetailPanel } from './TaskDetailPanel'
import { CreateTaskModal } from './CreateTaskModal'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAdmins } from '@/lib/hooks/useUsers'
import { useUpdateTask } from '@/lib/hooks/useTasks'
import { usePrefetchTask } from '@/lib/hooks/usePrefetchTask'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { cn } from '@/lib/utils'

interface TaskKanbanProps {
  projectId: string
  tasks: Task[]
  permissions: Permissions
  members?: ProjectMember[]
  domain?: TaskDomain
}

const STAGE_COLORS: Record<string, string> = {
  TODO: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  DEVELOPED: '#8b5cf6',
  CODE_REVIEW: '#a855f7',
  TESTING: '#f97316',
  TESTED: '#14b8a6',
  DEBUGGING: '#ef4444',
  FINAL_TESTING: '#ec4899',
  WIREFRAME: '#64748b',
  DESIGN: '#6366f1',
  REVIEW: '#06b6d4',
  REVISION: '#f43f5e',
  APPROVED: '#10b981',
  PLANNING: '#6366f1',
  EXECUTION: '#3b82f6',
  RESEARCH: '#8b5cf6',
  ANALYSIS: '#14b8a6',
  DOCUMENTATION: '#f97316',
  DONE: '#10b981',
}

const STAGE_BG: Record<string, string> = TASK_STATUS_COLORS

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-destructive',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-muted-foreground/40',
}

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'High',
  MEDIUM: 'Med',
  LOW: 'Low',
}

const PRIORITY_TEXT: Record<string, string> = {
  HIGH: 'text-destructive',
  MEDIUM: 'text-amber-700',
  LOW: 'text-muted-foreground',
}

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

type FilterStatus = 'ALL' | string
type SortOption = 'default' | 'priority' | 'deadline' | 'title' | 'created'

const SORT_LABELS: Record<SortOption, string> = {
  default: 'Default',
  priority: 'Priority',
  deadline: 'Deadline',
  title: 'Title',
  created: 'Newest',
}

export function TaskKanban({
  projectId,
  tasks,
  permissions,
  members = [],
  domain = 'DEVELOPMENT',
}: TaskKanbanProps) {
  const { user } = useAuth()
  const labelOf = useStatusLabel()
  const STAGES = DOMAIN_STATUSES[domain]
  const statusOptions = getStatusOptions(domain)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.taskId === selectedTaskId) ?? null
    : null
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TaskPriority>(
    'ALL'
  )
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('default')

  const { data: admins } = useAdmins()
  const updateTask = useUpdateTask(projectId)
  const toast = useToast()
  const confirm = useConfirm()
  const changeStatusWithUndo = async (
    taskId: string,
    prev: string,
    next: string
  ) => {
    if (prev === next) return
    // Reopening a completed task demands an explicit confirm so a stray
    // click in the dropdown can't silently un-finish shipped work.
    if (prev === 'DONE' && next !== 'DONE') {
      const ok = await confirm({
        title: 'Reopen completed task?',
        description:
          'This task is marked Done. Changing its status will move it back into active work. Continue?',
        confirmLabel: 'Reopen task',
        variant: 'danger',
      })
      if (!ok) return
    }
    updateTask.mutate({ taskId, data: { status: next as Parameters<typeof updateTask.mutate>[0]['data']['status'] } })
    const label = labelOf(next)
    toast.undoable(`Status changed to ${label}`, () => {
      updateTask.mutate({ taskId, data: { status: prev as Parameters<typeof updateTask.mutate>[0]['data']['status'] } })
    })
  }

  const nameMap = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl?: string }>()
    for (const mem of members) {
      m.set(mem.userId, {
        name: mem.user?.name || mem.user?.email || mem.userId,
        avatarUrl: mem.user?.avatarUrl,
      })
    }
    for (const a of admins ?? []) {
      if (!m.has(a.userId)) m.set(a.userId, { name: a.name || a.email })
    }
    return m
  }, [members, admins])

  const resolveUser = (userId: string) =>
    nameMap.get(userId) ?? { name: 'Unknown' }

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) {
      for (const uid of t.assignedTo ?? []) {
        if (!map.has(uid)) map.set(uid, resolveUser(uid).name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, nameMap])

  // Filter + search
  const filteredTasks = useMemo(() => {
    let result = tasks
    if (priorityFilter !== 'ALL')
      result = result.filter((t) => t.priority === priorityFilter)
    if (assigneeFilter !== 'ALL')
      result = result.filter((t) =>
        (t.assignedTo ?? []).includes(assigneeFilter)
      )
    if (showOverdueOnly) {
      result = result.filter((t) => checkOverdue(t.deadline, t.status))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase() ?? '').includes(q)
      )
    }
    return result
  }, [tasks, priorityFilter, assigneeFilter, showOverdueOnly, search])

  const activeFilterCount =
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (assigneeFilter !== 'ALL' ? 1 : 0) +
    (showOverdueOnly ? 1 : 0) +
    (search.trim() ? 1 : 0)

  // Sort
  const sortTasks = (list: Task[]): Task[] => {
    if (sort === 'default') return list
    return [...list].sort((a, b) => {
      if (sort === 'priority')
        return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'created')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return 0
    })
  }

  // Group tasks by pipeline stage; orphaned statuses fold into the closest bucket.
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const s of STAGES) map.set(s, [])
    for (const t of filteredTasks) {
      if (map.has(t.status)) {
        map.get(t.status)!.push(t)
      } else {
        const fallback = t.status === 'DONE' ? 'DONE' : STAGES[0]
        map.get(fallback)?.push(t)
      }
    }
    for (const s of STAGES) map.set(s, sortTasks(map.get(s) ?? []))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, sort, STAGES])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGES) counts[s] = 0
    for (const t of tasks) {
      if (STAGES.includes(t.status)) {
        counts[t.status] = (counts[t.status] ?? 0) + 1
      } else {
        const fallback = t.status === 'DONE' ? 'DONE' : STAGES[0]
        counts[fallback] = (counts[fallback] ?? 0) + 1
      }
    }
    return counts
  }, [tasks, STAGES])

  const toggleCollapse = (status: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(status)) n.delete(status)
      else n.add(status)
      return n
    })
  }

  const visibleStages =
    filter === 'ALL' ? STAGES : STAGES.filter((s) => s === filter)

  const clearAll = () => {
    setPriorityFilter('ALL')
    setAssigneeFilter('ALL')
    setShowOverdueOnly(false)
    setSearch('')
    setFilter('ALL')
    setSort('default')
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
            rightIcon={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="pointer-events-auto rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : undefined
            }
            className="h-9"
          />
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
              <ArrowDownUp className="h-3.5 w-3.5" />
              <span className="font-semibold">{SORT_LABELS[sort]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as SortOption)}
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
              <Flag className="h-3.5 w-3.5" />
              <span className="font-semibold">
                {priorityFilter === 'ALL'
                  ? 'All priorities'
                  : PRIORITY_LABEL[priorityFilter]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={priorityFilter}
              onValueChange={(v) =>
                setPriorityFilter(v as 'ALL' | TaskPriority)
              }
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="HIGH">High</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="MEDIUM">Medium</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="LOW">Low</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee */}
        {assigneeOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 gap-1.5 text-xs"
              >
                {assigneeFilter === 'ALL' ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                <span className="max-w-[120px] truncate font-semibold">
                  {assigneeFilter === 'ALL'
                    ? 'All members'
                    : resolveUser(assigneeFilter).name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Assignee</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
              >
                <DropdownMenuRadioItem value="ALL">
                  All members
                </DropdownMenuRadioItem>
                {assigneeOptions.map((a) => (
                  <DropdownMenuRadioItem key={a.id} value={a.id}>
                    {a.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Overdue pill */}
        <Button
          variant={showOverdueOnly ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          className={cn(
            'h-9 gap-1.5 text-xs',
            showOverdueOnly &&
              'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Overdue
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        )}

        <div className="ml-auto">
          {permissions.canCreateTask && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="h-9 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New task
            </Button>
          )}
        </div>
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StageChip
          label="All"
          count={filteredTasks.length}
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
        />
        {STAGES.map((stage) => (
          <StageChip
            key={stage}
            label={labelOf(stage)}
            count={statusCounts[stage]}
            color={STAGE_COLORS[stage]}
            activeBg={STAGE_BG[stage]}
            active={filter === stage}
            onClick={() => setFilter(filter === stage ? 'ALL' : stage)}
          />
        ))}
      </div>

      {/* Task groups */}
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create your first task to start tracking work on this project."
          action={
            permissions.canCreateTask && (
              <Button onClick={() => setShowCreateModal(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create first task
              </Button>
            )
          }
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks match your filters"
          description="Try clearing filters to see more tasks."
          action={
            <Button variant="secondary" size="sm" onClick={clearAll}>
              Clear all filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleStages.map((stage) => {
            const stageTasks = grouped.get(stage) ?? []
            const isCollapsed = collapsed.has(stage)
            if (stageTasks.length === 0 && filter === 'ALL') return null

            return (
              <div
                key={stage}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <button
                  type="button"
                  onClick={() => toggleCollapse(stage)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      !isCollapsed && 'rotate-90'
                    )}
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[stage] }}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {labelOf(stage)}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                      STAGE_BG[stage] || 'bg-muted text-muted-foreground'
                    )}
                  >
                    {stageTasks.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-border/60">
                    {stageTasks.length === 0 ? (
                      <div className="px-5 py-6 text-center text-xs text-muted-foreground">
                        No tasks in this stage
                      </div>
                    ) : (
                      stageTasks.map((task) => (
                        <TaskRow
                          key={task.taskId}
                          task={task}
                          domain={domain}
                          isAssignedToMe={
                            (task.assignedTo ?? []).includes(user?.userId ?? '')
                          }
                          onSelect={() => setSelectedTaskId(task.taskId)}
                          onStatusChange={(status) =>
                            changeStatusWithUndo(task.taskId, task.status, status)
                          }
                          statusOptions={statusOptions}
                          resolveUser={resolveUser}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TaskDetailPanel
        task={selectedTask}
        projectId={projectId}
        permissions={permissions}
        onClose={() => setSelectedTaskId(null)}
      />
      <CreateTaskModal
        projectId={projectId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}

// ─── Child components ──────────────────────────────────

interface StageChipProps {
  label: string
  count: number
  color?: string
  activeBg?: string
  active: boolean
  onClick: () => void
}

function StageChip({ label, count, color, activeBg, active, onClick }: StageChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
        active
          ? activeBg || 'bg-foreground text-background border-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground'
      )}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'rounded px-1 text-[10px] font-bold tabular-nums',
            active ? 'bg-foreground/10' : 'bg-muted-foreground/15'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

interface TaskRowProps {
  task: Task
  domain: TaskDomain
  isAssignedToMe: boolean
  onSelect: () => void
  onStatusChange: (status: string) => void
  statusOptions: { value: string; label: string }[]
  resolveUser: (userId: string) => { name: string; avatarUrl?: string }
}

function TaskRow({
  task,
  domain,
  isAssignedToMe,
  onSelect,
  onStatusChange,
  statusOptions,
  resolveUser,
}: TaskRowProps) {
  const labelOf = useStatusLabel()
  const overdue = checkOverdue(task.deadline, task.status)
  const progressPct = getStatusProgress(task.status, domain)
  const assignees = task.assignedTo ?? []
  const prefetchTask = usePrefetchTask()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('button, [role="menuitem"], [data-no-row-click]')) return
        onSelect()
      }}
      onMouseEnter={() => task.projectId && prefetchTask(task.projectId, task.taskId)}
      onFocus={() => task.projectId && prefetchTask(task.projectId, task.taskId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30"
    >
      {/* Priority pill */}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
          PRIORITY_TEXT[task.priority] || 'text-muted-foreground'
        )}
        title={`${PRIORITY_LABEL[task.priority] ?? task.priority} priority`}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            PRIORITY_DOT[task.priority] || 'bg-muted-foreground/40'
          )}
        />
        {PRIORITY_LABEL[task.priority] ?? task.priority}
      </span>

      {/* Title + progress + deadline */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {task.title}
          </p>
          {overdue && (
            <Badge
              tone="danger"
              size="sm"
              className="shrink-0"
            >
              Overdue
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <Progress value={progressPct} className="h-1 w-24" />
            <span className="shrink-0 tabular-nums">{progressPct}%</span>
          </div>
          {task.deadline && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <DeadlineLabel
                deadline={task.deadline}
                status={task.status}
                compact
              />
            </>
          )}
        </div>
      </div>

      {/* Inline status change */}
      {isAssignedToMe && (
        <div data-no-row-click>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
              >
                {labelOf(task.status)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Change status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={task.status}
                onValueChange={onStatusChange}
              >
                {statusOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Assignees */}
      <div className="flex shrink-0 items-center gap-2">
        {assignees.length === 0 ? (
          <span className="text-[10px] italic text-muted-foreground/60">
            Unassigned
          </span>
        ) : (
          <div className="flex items-center -space-x-1.5">
            {assignees.slice(0, 3).map((uid) => {
              const u = resolveUser(uid)
              return (
                <div
                  key={uid}
                  className="ring-2 ring-card rounded-full"
                  title={u.name}
                >
                  <Avatar url={u.avatarUrl} name={u.name} size="sm" />
                </div>
              )
            })}
            {assignees.length > 3 && (
              <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-card">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </div>
    </div>
  )
}
