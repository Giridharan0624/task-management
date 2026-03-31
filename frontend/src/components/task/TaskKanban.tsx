'use client'

import { useState, useMemo } from 'react'
import type { Task, TaskStatus } from '@/types/task'
import { TASK_STATUS_LABEL } from '@/types/task'
import type { ProjectMember } from '@/types/user'
import type { Permissions } from '@/lib/hooks/usePermission'
import { TaskDetailPanel } from './TaskDetailPanel'
import { CreateTaskModal } from './CreateTaskModal'
import { useAdmins } from '@/lib/hooks/useUsers'

interface TaskKanbanProps {
  projectId: string
  tasks: Task[]
  permissions: Permissions
  members?: ProjectMember[]
}

const STAGES: TaskStatus[] = [
  'TODO', 'IN_PROGRESS', 'DEVELOPED', 'TESTING',
  'TESTED', 'DEBUGGING', 'FINAL_TESTING', 'DONE',
]

const STAGE_COLOR: Record<TaskStatus, string> = {
  TODO: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  DEVELOPED: '#8b5cf6',
  TESTING: '#f97316',
  TESTED: '#14b8a6',
  DEBUGGING: '#ef4444',
  FINAL_TESTING: '#ec4899',
  DONE: '#10b981',
}

const STAGE_BG: Record<TaskStatus, string> = {
  TODO: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  DEVELOPED: 'bg-violet-50 text-violet-700 border-violet-200',
  TESTING: 'bg-orange-50 text-orange-700 border-orange-200',
  TESTED: 'bg-teal-50 text-teal-700 border-teal-200',
  DEBUGGING: 'bg-red-50 text-red-700 border-red-200',
  FINAL_TESTING: 'bg-pink-50 text-pink-700 border-pink-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const PRIORITY_INDICATOR: Record<string, { color: string; label: string }> = {
  HIGH: { color: 'bg-red-500', label: 'High' },
  MEDIUM: { color: 'bg-amber-400', label: 'Med' },
  LOW: { color: 'bg-gray-300', label: 'Low' },
}

type FilterStatus = 'ALL' | TaskStatus

export function TaskKanban({ projectId, tasks, permissions, members = [] }: TaskKanbanProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Always derive selectedTask from the latest tasks array so it stays in sync
  const selectedTask = selectedTaskId ? tasks.find(t => t.taskId === selectedTaskId) ?? null : null
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set())

  const { data: admins } = useAdmins()

  const nameMap = new Map<string, string>()
  const avatarMap = new Map<string, string | undefined>()
  for (const m of members) {
    nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
    if (m.user?.avatarUrl) avatarMap.set(m.userId, m.user.avatarUrl)
  }
  for (const a of admins ?? []) {
    if (!nameMap.has(a.userId)) nameMap.set(a.userId, a.name || a.email)
  }
  const resolveName = (userId: string) => nameMap.get(userId) || 'Unknown'
  const resolveInitials = (userId: string) => {
    const name = resolveName(userId)
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  // Group tasks by status
  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const s of STAGES) map.set(s, [])
    for (const t of tasks) {
      map.get(t.status)?.push(t)
    }
    return map
  }, [tasks])

  // Pipeline stats
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGES) counts[s] = grouped.get(s)?.length ?? 0
    return counts
  }, [grouped])

  const toggleCollapse = (status: TaskStatus) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const filteredStages = filter === 'ALL' ? STAGES : STAGES.filter(s => s === filter)

  return (
    <div className="flex flex-col gap-0">

      {/* ── Pipeline Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-[13px] font-bold text-gray-800 tracking-tight">Pipeline</h3>
            <span className="text-[11px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-md tabular-nums">{tasks.length}</span>
          </div>
          {permissions.canCreateTask && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-gray-800 active:bg-gray-950 transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              New Task
            </button>
          )}
        </div>

        {/* Stage pills row */}
        <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto">
          {/* All filter */}
          <button
            onClick={() => setFilter('ALL')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all flex-shrink-0 ${
              filter === 'ALL'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            All
            <span className={`tabular-nums ${filter === 'ALL' ? 'text-gray-300' : 'text-gray-400'}`}>{tasks.length}</span>
          </button>

          <div className="w-px h-5 bg-gray-100 flex-shrink-0" />

          {/* Status pills */}
          {STAGES.map((stage) => {
            const count = statusCounts[stage]
            const isActive = filter === stage
            const hasItems = count > 0
            return (
              <button
                key={stage}
                onClick={() => setFilter(isActive ? 'ALL' : stage)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all flex-shrink-0 border ${
                  isActive
                    ? `${STAGE_BG[stage]} shadow-sm`
                    : hasItems
                      ? 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                      : 'bg-white border-gray-50 text-gray-300'
                }`}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: STAGE_COLOR[stage], opacity: hasItems || isActive ? 1 : 0.3 }}
                />
                <span className="hidden sm:inline">{TASK_STATUS_LABEL[stage]}</span>
                <span className="sm:hidden">{TASK_STATUS_LABEL[stage].slice(0, 3)}</span>
                {hasItems && (
                  <span className={`tabular-nums ${isActive ? '' : 'text-gray-400'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Task List by Status Groups ── */}
      <div className="space-y-2">
        {filteredStages.map(stage => {
          const stageTasks = grouped.get(stage) ?? []
          const isCollapsed = collapsed.has(stage)
          if (stageTasks.length === 0 && filter === 'ALL') return null

          return (
            <div key={stage} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => toggleCollapse(stage)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                <span className="text-[13px] font-semibold text-gray-700">{TASK_STATUS_LABEL[stage]}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STAGE_BG[stage]}`}>
                  {stageTasks.length}
                </span>
                <span className="ml-auto text-[10px] text-gray-300 tabular-nums">Stage {STAGES.indexOf(stage) + 1}/{STAGES.length}</span>
              </button>

              {/* Task rows */}
              {!isCollapsed && (
                <div className="border-t border-gray-50">
                  {stageTasks.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-xs text-gray-300">No tasks in this stage</p>
                    </div>
                  ) : (
                    stageTasks.map((task, idx) => {
                      const isOverdue = task.deadline && task.status !== 'DONE' && new Date(task.deadline) < new Date()
                      const pri = PRIORITY_INDICATOR[task.priority]
                      const stageIdx = STAGES.indexOf(task.status)
                      const progressPct = Math.round(((stageIdx + 1) / STAGES.length) * 100)

                      return (
                        <button
                          key={task.taskId}
                          onClick={() => setSelectedTaskId(task.taskId)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50/70 transition-colors group ${
                            idx < stageTasks.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                        >
                          {/* Priority indicator — left edge bar */}
                          <div className={`w-[3px] h-8 rounded-full flex-shrink-0 ${pri.color}`} title={pri.label} />

                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-gray-950 transition-colors">
                                {task.title}
                              </p>
                              {isOverdue && (
                                <span className="flex-shrink-0 text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {/* Progress dots */}
                              <div className="flex items-center gap-[3px] flex-shrink-0" title={`${TASK_STATUS_LABEL[task.status]} — ${progressPct}%`}>
                                {STAGES.map((s, si) => (
                                  <div
                                    key={s}
                                    className="w-[6px] h-[6px] rounded-full"
                                    style={{
                                      backgroundColor: si <= stageIdx ? STAGE_COLOR[task.status] : '#e5e7eb',
                                    }}
                                  />
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
                          </div>

                          {/* Assignees */}
                          <div className="flex items-center -space-x-1.5 flex-shrink-0">
                            {(task.assignedTo ?? []).slice(0, 3).map((uid) => (
                              <span
                                key={uid}
                                className="inline-flex items-center justify-center rounded-full bg-gray-100 ring-2 ring-white text-[8px] font-bold text-gray-500"
                                style={{ width: 24, height: 24 }}
                                title={resolveName(uid)}
                              >
                                {resolveInitials(uid)}
                              </span>
                            ))}
                            {(task.assignedTo?.length ?? 0) > 3 && (
                              <span className="text-[10px] text-gray-400 pl-1">+{task.assignedTo!.length - 3}</span>
                            )}
                          </div>

                          {/* Arrow */}
                          <svg className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

      </div>

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
