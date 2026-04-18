'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyTasks, useUsers, useAdmins } from '@/lib/hooks/useUsers'
import { usePermission } from '@/lib/hooks/usePermission'
import { Spinner } from '@/components/ui/Spinner'
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

  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [view, setView] = useState<ViewMode>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>(defaults.groupBy)
  const [scope, setScope] = useState<Scope>(defaults.scope)
  const [statusChip, setStatusChip] = useState<StatusKey>('ALL')
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null)

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
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
        onFiltersChange={setFilters}
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
        />
      ) : (
        <TaskBoard tasks={visibleTasks} onSelectTask={setSelectedTask} />
      )}

      <TaskDetailPanel
        task={selectedTask as unknown as Task | null}
        projectId={selectedTask?.projectId ?? ''}
        permissions={permissions}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  )
}
