'use client'

import { useState, useMemo } from 'react'
import type { Task, TaskPriority, TaskDomain } from '@/types/task'
import { TASK_STATUS_LABEL, TASK_STATUS_COLORS, DOMAIN_STATUSES, getStatusOptions, getStatusProgress } from '@/types/task'
import type { ProjectMember } from '@/types/user'
import type { Permissions } from '@/lib/hooks/usePermission'
import { TaskDetailPanel } from './TaskDetailPanel'
import { CreateTaskModal } from './CreateTaskModal'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAdmins } from '@/lib/hooks/useUsers'
import { useUpdateTask } from '@/lib/hooks/useTasks'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { isOverdue as checkOverdue, parseDeadline } from '@/lib/utils/deadline'

interface TaskKanbanProps {
  projectId: string
  tasks: Task[]
  permissions: Permissions
  members?: ProjectMember[]
  domain?: TaskDomain
}

const STAGE_COLORS: Record<string, string> = {
  TODO: '#f59e0b', IN_PROGRESS: '#3b82f6', DEVELOPED: '#8b5cf6', CODE_REVIEW: '#a855f7',
  TESTING: '#f97316', TESTED: '#14b8a6', DEBUGGING: '#ef4444', FINAL_TESTING: '#ec4899',
  WIREFRAME: '#64748b', DESIGN: '#6366f1', REVIEW: '#06b6d4', REVISION: '#f43f5e', APPROVED: '#10b981',
  PLANNING: '#6366f1', EXECUTION: '#3b82f6',
  RESEARCH: '#8b5cf6', ANALYSIS: '#14b8a6', DOCUMENTATION: '#f97316',
  DONE: '#10b981',
}

const STAGE_BG: Record<string, string> = TASK_STATUS_COLORS

const PRIORITY_INDICATOR: Record<string, { color: string; label: string }> = {
  HIGH: { color: 'bg-red-500', label: 'High' },
  MEDIUM: { color: 'bg-amber-400', label: 'Med' },
  LOW: { color: 'bg-gray-300', label: 'Low' },
}

type FilterStatus = 'ALL' | string
type SortOption = 'default' | 'priority' | 'deadline' | 'title' | 'created'

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export function TaskKanban({ projectId, tasks, permissions, members = [], domain = 'DEVELOPMENT' }: TaskKanbanProps) {
  const { user } = useAuth()
  const STAGES = DOMAIN_STATUSES[domain]
  const statusOptions = getStatusOptions(domain)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = selectedTaskId ? tasks.find(t => t.taskId === selectedTaskId) ?? null : null
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TaskPriority>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('default')

  const { data: admins } = useAdmins()
  const updateTask = useUpdateTask(projectId)

  const nameMap = new Map<string, string>()
  for (const m of members) nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
  for (const a of admins ?? []) { if (!nameMap.has(a.userId)) nameMap.set(a.userId, a.name || a.email) }
  const resolveName = (userId: string) => nameMap.get(userId) || 'Unknown'
  const resolveInitials = (userId: string) => resolveName(userId).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) for (const uid of t.assignedTo ?? []) { if (!map.has(uid)) map.set(uid, resolveName(uid)) }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  // Filter + search
  const filteredTasks = useMemo(() => {
    let result = tasks
    if (priorityFilter !== 'ALL') result = result.filter(t => t.priority === priorityFilter)
    if (assigneeFilter !== 'ALL') result = result.filter(t => (t.assignedTo ?? []).includes(assigneeFilter))
    if (showOverdueOnly) {
      const now = new Date()
      result = result.filter(t => checkOverdue(t.deadline, t.status))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    }
    return result
  }, [tasks, priorityFilter, assigneeFilter, showOverdueOnly, search])

  const activeFilterCount = (priorityFilter !== 'ALL' ? 1 : 0) + (assigneeFilter !== 'ALL' ? 1 : 0) + (showOverdueOnly ? 1 : 0) + (search.trim() ? 1 : 0)

  // Sort
  const sortTasks = (list: Task[]) => {
    if (sort === 'default') return list
    return [...list].sort((a, b) => {
      if (sort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return 0
    })
  }

  // Group — tasks whose status doesn't exist in the current domain pipeline
  // are placed in the closest matching stage or shown separately
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const s of STAGES) map.set(s, [])
    for (const t of filteredTasks) {
      if (map.has(t.status)) {
        map.get(t.status)!.push(t)
      } else {
        // Status doesn't exist in current domain — find closest match or put in first stage
        const closestStage = t.status === 'DONE' ? 'DONE' : STAGES[0]
        map.get(closestStage)?.push(t)
      }
    }
    // Apply sort within each group
    for (const s of STAGES) map.set(s, sortTasks(map.get(s) ?? []))
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, sort])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGES) counts[s] = 0
    for (const t of tasks) {
      if (STAGES.includes(t.status)) {
        counts[t.status] = (counts[t.status] ?? 0) + 1
      } else {
        // Orphaned status — count under first stage (or DONE)
        const fallback = t.status === 'DONE' ? 'DONE' : STAGES[0]
        counts[fallback] = (counts[fallback] ?? 0) + 1
      }
    }
    return counts
  }, [tasks])

  const toggleCollapse = (status: string) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(status) ? n.delete(status) : n.add(status); return n })
  }

  const filteredStages = filter === 'ALL' ? STAGES : STAGES.filter(s => s === filter)

  const clearAll = () => {
    setPriorityFilter('ALL'); setAssigneeFilter('ALL'); setShowOverdueOnly(false); setSearch(''); setFilter('ALL'); setSort('default')
  }

  return (
    <div className="flex flex-col gap-0">

      {/* ── Pipeline Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        {/* Top bar */}
        <div className="flex flex-col gap-3 px-5 py-4 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-bold text-gray-800 tracking-tight">Pipeline</h3>
              <span className="text-[11px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-md tabular-nums">{tasks.length}</span>
            </div>
            {permissions.canCreateTask && (
              <button onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-gray-800 active:bg-gray-950 transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                New Task
              </button>
            )}
          </div>

          {/* Search + Sort + Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-1.5 text-[12px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white focus:border-indigo-400 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Sort */}
            <FilterSelect value={sort} onChange={v => setSort(v as SortOption)} active={sort !== 'default'}
              options={[{ value: 'default', label: 'Sort by' }, { value: 'priority', label: 'Sort: Priority' }, { value: 'deadline', label: 'Sort: Deadline' }, { value: 'title', label: 'Sort: Title' }, { value: 'created', label: 'Sort: Created' }]} />

            <div className="w-px h-5 bg-gray-100 flex-shrink-0" />

            {/* Priority filter */}
            <FilterSelect value={priorityFilter} onChange={v => setPriorityFilter(v as 'ALL' | TaskPriority)} active={priorityFilter !== 'ALL'}
              options={[{ value: 'ALL', label: 'All Priorities' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />

            {/* Assignee filter */}
            {assigneeOptions.length > 0 && (
              <FilterSelect value={assigneeFilter} onChange={setAssigneeFilter} active={assigneeFilter !== 'ALL'} className="max-w-[140px]"
                options={[{ value: 'ALL', label: 'All Members' }, ...assigneeOptions.map(a => ({ value: a.id, label: a.name }))]} />
            )}

            {/* Overdue toggle */}
            <button onClick={() => setShowOverdueOnly(!showOverdueOnly)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${showOverdueOnly ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              Overdue
            </button>

            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-[11px] text-gray-400 hover:text-gray-600 font-medium transition-colors">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto">
          <button onClick={() => setFilter('ALL')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all flex-shrink-0 ${filter === 'ALL' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            All
            <span className={`tabular-nums ${filter === 'ALL' ? 'text-gray-300' : 'text-gray-400'}`}>{filteredTasks.length}{activeFilterCount > 0 ? `/${tasks.length}` : ''}</span>
          </button>
          <div className="w-px h-5 bg-gray-100 flex-shrink-0" />
          {STAGES.map(stage => {
            const count = statusCounts[stage]; const isActive = filter === stage; const hasItems = count > 0
            return (
              <button key={stage} onClick={() => setFilter(isActive ? 'ALL' : stage)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all flex-shrink-0 border ${isActive ? `${STAGE_BG[stage]} shadow-sm` : hasItems ? 'bg-white border-gray-200 text-gray-600 hover:border-gray-300' : 'bg-white border-gray-200 text-gray-400'}`}>
                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[stage], opacity: hasItems || isActive ? 1 : 0.3 }} />
                <span className="hidden sm:inline">{TASK_STATUS_LABEL[stage]}</span>
                <span className="sm:hidden">{TASK_STATUS_LABEL[stage].slice(0, 3)}</span>
                {hasItems && <span className={`tabular-nums ${isActive ? '' : 'text-gray-400'}`}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Task List ── */}
      <div className="space-y-2">
        {filteredStages.map(stage => {
          const stageTasks = grouped.get(stage) ?? []
          const isCollapsed = collapsed.has(stage)
          if (stageTasks.length === 0 && filter === 'ALL') return null

          return (
            <div key={stage} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse(stage)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                <span className="text-[13px] font-semibold text-gray-700">{TASK_STATUS_LABEL[stage]}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STAGE_BG[stage]}`}>{stageTasks.length}</span>
                <span className="ml-auto text-[10px] text-gray-300 tabular-nums">Stage {STAGES.indexOf(stage) + 1}/{STAGES.length}</span>
              </button>

              {!isCollapsed && (
                <div className="border-t border-gray-50">
                  {stageTasks.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-xs text-gray-300">No tasks in this stage</p>
                    </div>
                  ) : stageTasks.map((task, idx) => {
                    const isOverdue = checkOverdue(task.deadline, task.status)
                    const pri = PRIORITY_INDICATOR[task.priority]
                    const stageIdx = STAGES.indexOf(task.status)
                    const progressPct = getStatusProgress(task.status, domain)

                    return (
                      <div key={task.taskId}
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors group ${idx < stageTasks.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        {/* Priority bar */}
                        <div className={`w-[3px] h-8 rounded-full flex-shrink-0 ${pri.color}`} title={pri.label} />

                        {/* Task info — clickable */}
                        <button onClick={() => setSelectedTaskId(task.taskId)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-gray-950 transition-colors">
                              {task.title}
                            </p>
                            {isOverdue && (
                              <span className="flex-shrink-0 text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-[3px] flex-shrink-0" title={`${TASK_STATUS_LABEL[task.status]} — ${progressPct}%`}>
                              {STAGES.map((s, si) => (
                                <div key={s} className="w-[6px] h-[6px] rounded-full"
                                  style={{ backgroundColor: si <= stageIdx ? STAGE_COLORS[task.status] : '#e5e7eb' }} />
                              ))}
                            </div>
                            <span className="text-[10px] text-gray-400 tabular-nums">{progressPct}%</span>
                            {task.deadline && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className={`text-[10px] tabular-nums ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                  {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Quick status change — only for assigned user */}
                        {(task.assignedTo ?? []).includes(user?.userId ?? '') && (
                          <div onClick={e => e.stopPropagation()}>
                            <FilterSelect value={task.status} onChange={v => updateTask.mutate({ taskId: task.taskId, data: { status: v as string } })}
                              options={statusOptions} className="max-w-[120px]" />
                          </div>
                        )}

                        {/* Assignees */}
                        <div className="flex items-center -space-x-1.5 flex-shrink-0">
                          {(task.assignedTo ?? []).slice(0, 3).map(uid => (
                            <span key={uid} className="inline-flex items-center justify-center rounded-full bg-gray-100 ring-2 ring-white text-[8px] font-bold text-gray-500"
                              style={{ width: 24, height: 24 }} title={resolveName(uid)}>
                              {resolveInitials(uid)}
                            </span>
                          ))}
                          {(task.assignedTo?.length ?? 0) > 3 && (
                            <span className="text-[10px] text-gray-400 pl-1">+{task.assignedTo!.length - 3}</span>
                          )}
                        </div>

                        {/* Arrow */}
                        <button onClick={() => setSelectedTaskId(task.taskId)} className="flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <h3 className="text-[15px] font-bold text-gray-800 mb-1">No tasks yet</h3>
            <p className="text-[13px] text-gray-400 mb-5 max-w-xs mx-auto">Create your first task to start tracking work on this project</p>
            {permissions.canCreateTask && (
              <button onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-gray-800 transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create First Task
              </button>
            )}
          </div>
        )}

        {/* No results from filters */}
        {tasks.length > 0 && filteredTasks.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="text-[13px] text-gray-500 font-medium">No tasks match your filters</p>
            <button onClick={clearAll} className="text-[12px] text-indigo-600 font-semibold mt-2 hover:text-indigo-800 transition-colors">Clear all filters</button>
          </div>
        )}
      </div>

      <TaskDetailPanel task={selectedTask} projectId={projectId} permissions={permissions} onClose={() => setSelectedTaskId(null)} />
      <CreateTaskModal projectId={projectId} isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  )
}
