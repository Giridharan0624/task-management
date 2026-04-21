'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, UserPlus, Flag, Search, ChevronDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyTasks, useUsers, useAdmins } from '@/lib/hooks/useUsers'
import { usePermission } from '@/lib/hooks/usePermission'
import { useUrlParam, useUrlState } from '@/lib/hooks/useUrlState'
import { useMultiSelect } from '@/lib/hooks/useMultiSelect'
import { useSavedViews } from '@/lib/hooks/useSavedViews'
import { updateTask as updateTaskApi, assignTask as assignTaskApi } from '@/lib/api/taskApi'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { SavedViewsBar } from '@/components/ui/SavedViewsBar'
import { Avatar } from '@/components/ui/AvatarUpload'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/Input'
import { SkeletonTable, SkeletonCard } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { TaskDetailPanel } from '@/components/task/TaskDetailPanel'
import {
  TaskToolbar,
  EMPTY_FILTERS,
  type TaskFilters,
  type ViewMode,
  type GroupBy,
  type Scope,
} from '@/components/task/TaskToolbar'
import { TaskStatStrip, type StatusKey } from '@/components/task/TaskStatStrip'
import { TaskListView } from '@/components/task/TaskListView'
import { TaskBoard } from '@/components/task/TaskBoard'
import { TASK_STATUS_PROGRESS } from '@/types/task'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import type { MyTask } from '@/lib/api/userApi'
import type { Task, TaskPriority } from '@/types/task'
import type { User } from '@/types/user'

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

function defaultsForRole(role: Role): {
  scope: Scope
  groupBy: GroupBy
  showScopeToggle: boolean
  showAssignee: boolean
} {
  switch (role) {
    case 'OWNER':
      return { scope: 'team', groupBy: 'project', showScopeToggle: false, showAssignee: true }
    case 'ADMIN':
      return { scope: 'mine', groupBy: 'project', showScopeToggle: true, showAssignee: true }
    case 'MEMBER':
    default:
      return { scope: 'mine', groupBy: 'none', showScopeToggle: false, showAssignee: false }
  }
}

export default function TasksPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useMyTasks()
  const { data: allUsers } = useUsers()
  const { data: adminList } = useAdmins()
  const permissions = usePermission(undefined, user?.systemRole)

  const role: Role = (user?.systemRole ?? 'MEMBER') as Role
  const defaults = defaultsForRole(role)

  // Filters are URL-synced so views are shareable and survive refresh.
  // Using a stable defaults object so useUrlState doesn't thrash on re-renders.
  const [filters, patchFilters] = useUrlState<TaskFilters>(EMPTY_FILTERS)
  const [view, setView] = useUrlParam<ViewMode>('view', 'list')
  const [groupBy, setGroupBy] = useUrlParam<GroupBy>('group', defaults.groupBy)
  const [scope, setScope] = useUrlParam<Scope>('scope', defaults.scope)
  const [statusChip, setStatusChip] = useUrlParam<StatusKey>('status', 'ALL')
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null)
  const multiSelect = useMultiSelect<string>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [bulkRunning, setBulkRunning] = useState(false)

  // Saved views — URL state already holds the snapshot shape, so we just
  // read current searchParams + replace() on apply.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const savedViews = useSavedViews('my-tasks', user?.userId)

  const currentUrlParams = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      out[key] = value
    })
    return out
  }, [searchParams])

  const applySavedView = (view: { params: Record<string, string> }) => {
    const qs = new URLSearchParams(view.params).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Only offer "Save" when at least one filter is active — otherwise we'd
  // be saving the default view, which is just "no filters".
  const hasActiveFilters = Object.keys(currentUrlParams).length > 0

  const nameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of allUsers ?? []) m.set(u.userId, u.name || u.email)
    for (const a of adminList ?? []) {
      if (!m.has(a.userId)) m.set(a.userId, a.name || a.email)
    }
    if (user) m.set(user.userId, user.name || user.email)
    return m
  }, [allUsers, adminList, user])

  const resolveName = (id: string) => nameMap.get(id) || 'Unknown'

  const allTasks = tasks ?? []

  // 1. Scope (mine vs team)
  const scopedTasks = useMemo(() => {
    if (role === 'OWNER') return allTasks // always team
    if (role === 'MEMBER') {
      return allTasks.filter((t) =>
        (t.assignedTo ?? []).includes(user?.userId ?? '')
      )
    }
    // ADMIN: toggleable
    if (scope === 'mine') {
      return allTasks.filter((t) =>
        (t.assignedTo ?? []).includes(user?.userId ?? '')
      )
    }
    return allTasks
  }, [allTasks, role, scope, user?.userId])

  // 2. Stat counts (computed pre-chip-filter so chip values always reflect scope)
  const stats = useMemo(() => {
    const todo = scopedTasks.filter((t) => t.status === 'TODO').length
    const done = scopedTasks.filter((t) => t.status === 'DONE').length
    const active = scopedTasks.length - todo - done
    const overdue = scopedTasks.filter((t) =>
      checkOverdue(t.deadline, t.status)
    ).length
    return { total: scopedTasks.length, todo, active, done, overdue }
  }, [scopedTasks])

  // 3. Stat-chip filter
  const chipFiltered = useMemo(() => {
    switch (statusChip) {
      case 'TODO':
        return scopedTasks.filter((t) => t.status === 'TODO')
      case 'DONE':
        return scopedTasks.filter((t) => t.status === 'DONE')
      case 'ACTIVE':
        return scopedTasks.filter(
          (t) => t.status !== 'TODO' && t.status !== 'DONE'
        )
      case 'OVERDUE':
        return scopedTasks.filter((t) => checkOverdue(t.deadline, t.status))
      default:
        return scopedTasks
    }
  }, [scopedTasks, statusChip])

  // 4. Toolbar filters + sort
  const visibleTasks = useMemo(() => {
    let list = chipFiltered

    if (filters.priority !== 'ALL') {
      list = list.filter((t) => t.priority === (filters.priority as TaskPriority))
    }
    if (filters.overdueOnly) {
      list = list.filter((t) => checkOverdue(t.deadline, t.status))
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.projectName || '').toLowerCase().includes(q)
      )
    }

    // Sort — default: priority then deadline
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (filters.sort === 'title') return a.title.localeCompare(b.title)
      if (filters.sort === 'status') {
        return (
          (TASK_STATUS_PROGRESS[a.status] ?? 0) -
          (TASK_STATUS_PROGRESS[b.status] ?? 0)
        )
      }
      if (filters.sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      // default + priority: priority first, then deadline
      const p =
        (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (p !== 0) return p
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })
    return sorted
  }, [chipFiltered, filters])

  // ── Bulk action helpers ────────────────────────────────────────────────
  // Each bulk helper fires one request per task, then invalidates the cross-
  // project caches. We use allSettled so a single project-membership failure
  // (e.g. assignee not in one of the projects) doesn't block the rest.
  const selectedTasksList = () =>
    visibleTasks.filter((t) => multiSelect.isSelected(t.taskId))

  const invalidateTaskCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const reportBulkOutcome = (
    results: PromiseSettledResult<unknown>[],
    successMessage: (n: number) => string
  ) => {
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (failed === 0) toast.success(successMessage(ok))
    else if (ok === 0) toast.error(`Failed to update ${failed} task${failed === 1 ? '' : 's'}`)
    else toast.info(`Updated ${ok}, failed ${failed}`)
  }

  const bulkMarkDone = async () => {
    const selectedTasks = selectedTasksList()
    if (selectedTasks.length === 0) return
    setBulkRunning(true)
    try {
      const results = await Promise.allSettled(
        selectedTasks.map((t) =>
          updateTaskApi(t.projectId, t.taskId, { status: 'DONE' })
        )
      )
      invalidateTaskCaches()
      reportBulkOutcome(results, (n) => `Marked ${n} task${n === 1 ? '' : 's'} as done`)
      multiSelect.clear()
    } finally {
      setBulkRunning(false)
    }
  }

  // Adds `userId` to every selected task's assignees. Idempotent: tasks that
  // already have the user assigned skip the request entirely.
  const bulkAssign = async (userId: string, userName: string) => {
    const selectedTasks = selectedTasksList()
    if (selectedTasks.length === 0) return
    setBulkRunning(true)
    try {
      const pending = selectedTasks.filter(
        (t) => !(t.assignedTo ?? []).includes(userId)
      )
      if (pending.length === 0) {
        toast.info(`${userName} is already assigned to every selected task`)
        return
      }
      const results = await Promise.allSettled(
        pending.map((t) =>
          assignTaskApi(t.projectId, t.taskId, [
            ...(t.assignedTo ?? []),
            userId,
          ])
        )
      )
      invalidateTaskCaches()
      reportBulkOutcome(
        results,
        (n) => `Assigned ${userName} to ${n} task${n === 1 ? '' : 's'}`
      )
      multiSelect.clear()
    } finally {
      setBulkRunning(false)
    }
  }

  const bulkSetPriority = async (priority: TaskPriority) => {
    const selectedTasks = selectedTasksList()
    if (selectedTasks.length === 0) return
    setBulkRunning(true)
    try {
      const pending = selectedTasks.filter((t) => t.priority !== priority)
      if (pending.length === 0) {
        toast.info(`Every selected task is already ${priority.toLowerCase()}`)
        return
      }
      const results = await Promise.allSettled(
        pending.map((t) =>
          updateTaskApi(t.projectId, t.taskId, { priority })
        )
      )
      invalidateTaskCaches()
      reportBulkOutcome(
        results,
        (n) => `Set ${n} task${n === 1 ? '' : 's'} to ${priority.toLowerCase()} priority`
      )
      multiSelect.clear()
    } finally {
      setBulkRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable rows={6} />
      </div>
    )
  }

  const pageDescription =
    role === 'MEMBER'
      ? 'Tasks assigned to you'
      : scope === 'team' || role === 'OWNER'
        ? 'All tasks across the workspace'
        : 'Tasks assigned to you'

  return (
    <div className="flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
      <PageHeader title="Tasks" description={pageDescription} />

      <SavedViewsBar
        views={savedViews.views}
        currentParams={currentUrlParams}
        onApply={applySavedView}
        onSave={savedViews.save}
        onRemove={savedViews.remove}
        onRename={savedViews.rename}
        saveDisabled={!hasActiveFilters}
      />

      <TaskStatStrip
        total={stats.total}
        todo={stats.todo}
        active={stats.active}
        done={stats.done}
        overdue={stats.overdue}
        selected={statusChip}
        onSelect={setStatusChip}
      />

      <TaskToolbar
        filters={filters}
        onFiltersChange={patchFilters}
        view={view}
        onViewChange={setView}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        scope={scope}
        onScopeChange={setScope}
        showScopeToggle={defaults.showScopeToggle}
      />

      {view === 'list' ? (
        <TaskListView
          tasks={visibleTasks}
          groupBy={groupBy}
          showAssignee={defaults.showAssignee}
          resolveName={resolveName}
          onSelectTask={setSelectedTask}
          selection={{
            isSelected: multiSelect.isSelected,
            toggle: multiSelect.toggle,
            selectAll: multiSelect.selectAll,
            isAllSelected: multiSelect.isAllSelected,
          }}
        />
      ) : (
        <TaskBoard tasks={visibleTasks} onSelectTask={setSelectedTask} />
      )}

      <BulkActionBar
        count={multiSelect.count}
        label={multiSelect.count === 1 ? 'task selected' : 'tasks selected'}
        onClear={multiSelect.clear}
      >
        <Button
          size="sm"
          variant="primary"
          onClick={bulkMarkDone}
          loading={bulkRunning}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark done
        </Button>
        <BulkAssignPopover
          users={allUsers ?? []}
          disabled={bulkRunning}
          onPick={(u) => bulkAssign(u.userId, u.name || u.email)}
        />
        <BulkPriorityMenu
          disabled={bulkRunning}
          onPick={(p) => bulkSetPriority(p)}
        />
      </BulkActionBar>

      <TaskDetailPanel
        task={selectedTask as unknown as Task | null}
        projectId={selectedTask?.projectId ?? ''}
        permissions={permissions}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  )
}

function BulkAssignPopover({
  users,
  disabled,
  onPick,
}: {
  users: User[]
  disabled: boolean
  onPick: (user: User) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const assignable = useMemo(
    () =>
      users.filter(
        (u) => u.systemRole !== 'OWNER' && (u.name || u.email)
      ),
    [users]
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assignable
    return assignable.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    )
  }, [assignable, query])

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          aria-label="Assign selected tasks"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b border-border p-2">
          <Input
            leftIcon={<Search />}
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No match
            </p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => {
                  onPick(u)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <Avatar url={u.avatarUrl} name={u.name || u.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {u.name || u.email}
                  </p>
                  {u.name && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {u.email}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BulkPriorityMenu({
  disabled,
  onPick,
}: {
  disabled: boolean
  onPick: (p: TaskPriority) => void
}) {
  const OPTIONS: { value: TaskPriority; label: string; dot: string }[] = [
    { value: 'HIGH', label: 'High', dot: 'bg-destructive' },
    { value: 'MEDIUM', label: 'Medium', dot: 'bg-amber-500' },
    { value: 'LOW', label: 'Low', dot: 'bg-slate-400' },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          aria-label="Set priority on selected tasks"
        >
          <Flag className="h-3.5 w-3.5" />
          Priority
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Set priority</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value=""
          onValueChange={(v) => onPick(v as TaskPriority)}
        >
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <span
                className={`mr-2 inline-block h-2 w-2 rounded-full ${o.dot}`}
              />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
