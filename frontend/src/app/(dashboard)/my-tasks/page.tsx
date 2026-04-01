'use client'

import { useState } from 'react'
import { useMyTasks, useUsers, useAdmins } from '@/lib/hooks/useUsers'
import { useCreateDirectTask } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { Select } from '@/components/ui/Select'
import { UserMultiSelect } from '@/components/ui/UserSelect'
import { TaskDetailPanel } from '@/components/task/TaskDetailPanel'
import { FilterSelect } from '@/components/ui/FilterSelect'
import Link from 'next/link'
import type { MyTask } from '@/lib/api/userApi'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_COLORS, TASK_STATUS_LABEL, TASK_STATUS_OPTIONS, TASK_STATUS_PROGRESS } from '@/types/task'
import type { Permissions } from '@/lib/hooks/usePermission'
import { useUpdateTask } from '@/lib/hooks/useTasks'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'

type FilterStatus = 'ALL' | TaskStatus
type TabType = 'my' | 'all'
type SortOption = 'default' | 'priority' | 'deadline' | 'title' | 'status'

const STATUS_COLORS: Record<string, string> = TASK_STATUS_COLORS

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 border border-orange-200',
  LOW: 'bg-slate-50 text-slate-600 border border-slate-200',
}

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const TOP_TIER = ['OWNER', 'CEO', 'MD']

export default function TasksPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useMyTasks()
  const { data: allUsers } = useUsers()
  const systemPerms = useSystemPermission(user?.systemRole)
  const createDirectTask = useCreateDirectTask()
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TaskPriority>('ALL')
  const [sort, setSort] = useState<SortOption>('default')
  const [activeTab, setActiveTab] = useState<TabType>('my')
  const [showAssign, setShowAssign] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedDirectTask, setSelectedDirectTask] = useState<Task | null>(null)

  const isTopTier = TOP_TIER.includes(user?.systemRole ?? '')
  const isAdmin = user?.systemRole === 'ADMIN'
  const isMember = user?.systemRole === 'MEMBER'
  const showTabs = isAdmin // Only admins get two tabs

  const { data: adminList } = useAdmins()

  // Name resolver — combines all users + admins + current user
  const nameMap = new Map<string, string>()
  for (const u of allUsers ?? []) nameMap.set(u.userId, u.name || u.email)
  for (const a of adminList ?? []) { if (!nameMap.has(a.userId)) nameMap.set(a.userId, a.name || a.email) }
  if (user) nameMap.set(user.userId, user.name || user.email)
  const resolveName = (id: string) => nameMap.get(id) || 'Unknown'

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  const allTasks = tasks ?? []

  // Split tasks
  const myAssignedTasks = allTasks.filter((t) => (t.assignedTo ?? []).includes(user?.userId ?? ''))
  const otherTasks = allTasks.filter((t) => !(t.assignedTo ?? []).includes(user?.userId ?? ''))

  // Top-tier: always all tasks. Admin: based on tab. Member: only assigned.
  const visibleTasks = isTopTier
    ? allTasks
    : isMember
      ? myAssignedTasks
      : activeTab === 'my'
        ? myAssignedTasks
        : allTasks

  const todoCount = visibleTasks.filter(t => t.status === 'TODO').length
  const activeCount = visibleTasks.filter(t => t.status !== 'TODO' && t.status !== 'DONE').length
  const doneCount = visibleTasks.filter(t => t.status === 'DONE').length
  const overdueCount = visibleTasks.filter(t => checkOverdue(t.deadline, t.status)).length

  let filteredTasks = filter === 'ALL' ? visibleTasks : visibleTasks.filter(t => t.status === filter)
  if (priorityFilter !== 'ALL') filteredTasks = filteredTasks.filter(t => t.priority === priorityFilter)
  if (search.trim()) {
    const q = search.toLowerCase()
    filteredTasks = filteredTasks.filter(t => t.title.toLowerCase().includes(q) || (t.projectName || '').toLowerCase().includes(q))
  }
  // Sort
  if (sort !== 'default') {
    filteredTasks = [...filteredTasks].sort((a, b) => {
      if (sort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0; if (!a.deadline) return 1; if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'status') return (TASK_STATUS_PROGRESS[a.status] ?? 0) - (TASK_STATUS_PROGRESS[b.status] ?? 0)
      return 0
    })
  }

  return (
    <div className="w-full max-w-6xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isMember ? 'Tasks assigned to you' : 'View and manage all tasks'}
          </p>
        </div>
        {systemPerms.canAssignTasks && (
          <Button onClick={() => setShowAssign(true)}>
            Assign Task
          </Button>
        )}
      </div>

      {/* Tabs — only for ADMIN and TOP_TIER */}
      {showTabs && (
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('my'); setFilter('ALL') }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'my'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            My Tasks ({myAssignedTasks.length})
          </button>
          <button
            onClick={() => { setActiveTab('all'); setFilter('ALL') }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All Tasks ({allTasks.length})
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'ALL' as FilterStatus, label: 'Total', value: visibleTasks.length, active: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-700' },
          { key: 'TODO' as FilterStatus, label: 'To Do', value: todoCount, active: 'border-amber-200 bg-amber-50', text: 'text-amber-700' },
          { key: 'ALL' as FilterStatus, label: 'Active', value: activeCount, active: 'border-blue-200 bg-blue-50', text: 'text-blue-700', isActive: true },
          { key: 'DONE' as FilterStatus, label: 'Done', value: doneCount, active: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' },
        ] as { key: FilterStatus; label: string; value: number; active: string; text: string; isActive?: boolean }[]).map(({ key, label, value, active, text, isActive: isActiveCard }) => (
          <button key={label} onClick={() => { if (!isActiveCard) setFilter(filter === key && key !== 'ALL' ? 'ALL' : key) }}
            className={`rounded-xl p-3 border text-left transition-all ${filter === key && !isActiveCard ? active : 'border-gray-100 bg-white hover:border-gray-200'} shadow-sm`}>
            <p className={`text-xl font-bold tracking-tight tabular-nums ${text}`}>{value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + Sort + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[12px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white focus:border-indigo-400 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        </div>
        <FilterSelect value={sort} onChange={v => setSort(v as SortOption)} active={sort !== 'default'}
          options={[{ value: 'default', label: 'Sort by' }, { value: 'priority', label: 'Priority' }, { value: 'deadline', label: 'Deadline' }, { value: 'title', label: 'Title' }, { value: 'status', label: 'Status' }]} />
        <FilterSelect value={priorityFilter} onChange={v => setPriorityFilter(v as 'ALL' | TaskPriority)} active={priorityFilter !== 'ALL'}
          options={[{ value: 'ALL', label: 'All Priorities' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
        {(search || sort !== 'default' || priorityFilter !== 'ALL' || filter !== 'ALL') && (
          <button onClick={() => { setSearch(''); setSort('default'); setPriorityFilter('ALL'); setFilter('ALL') }}
            className="text-[11px] text-gray-400 hover:text-gray-600 font-medium whitespace-nowrap">Clear all</button>
        )}
        {overdueCount > 0 && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1.5 rounded-lg tabular-nums">{overdueCount} overdue</span>
        )}
      </div>

      {/* Task Table */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">
            {filter === 'ALL' ? 'No tasks found.' : `No ${filter.replace('_', ' ').toLowerCase()} tasks.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Task</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Source</th>
                {!isMember && (
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assigned To</th>
                )}
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assigned By</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Deadline</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Progress</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTasks.map((task) => {
                const isOverdue = checkOverdue(task.deadline, task.status)
                const isDirect = task.projectId === 'DIRECT'
                return (
                  <tr key={task.taskId} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => {
                    if (isDirect) {
                      setSelectedDirectTask({
                        taskId: task.taskId, projectId: 'DIRECT', title: task.title,
                        description: task.description, status: task.status, priority: task.priority,
                        assignedTo: task.assignedTo, assignedBy: task.assignedBy, createdBy: task.createdBy,
                        deadline: task.deadline, createdAt: task.createdAt, updatedAt: task.updatedAt,
                      } as Task)
                    }
                  }}>
                    <td className="px-5 py-3.5">
                      {isDirect ? (
                        <span className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                          {task.title}
                        </span>
                      ) : (
                        <Link href={`/projects/${task.projectId}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                          {task.title}
                        </Link>
                      )}
                      {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${
                        isDirect ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600'
                      }`}>
                        {isDirect ? 'Direct' : task.projectName}
                      </span>
                    </td>
                    {!isMember && (
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(task.assignedTo ?? []).map((uid: string) => (
                            <span key={uid} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                              {resolveName(uid)}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                      {task.assignedByName || (task.assignedBy ? resolveName(task.assignedBy) : '—')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        {isOverdue && ' !'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[task.status] || 'bg-gray-50 text-gray-600'}`}>
                        {TASK_STATUS_LABEL[task.status] ?? task.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const pct = TASK_STATUS_PROGRESS[task.status] ?? 0
                        const color = pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : pct > 0 ? '#3b82f6' : '#d1d5db'
                        return (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-gray-50">
            {filteredTasks.map((task) => {
              const isOverdue = checkOverdue(task.deadline, task.status)
              const isDirect = task.projectId === 'DIRECT'
              return (
                <div key={task.taskId} onClick={() => {
                  if (isDirect) {
                    setSelectedDirectTask({
                      taskId: task.taskId, projectId: 'DIRECT', title: task.title,
                      description: task.description, status: task.status, priority: task.priority,
                      assignedTo: task.assignedTo, assignedBy: task.assignedBy, createdBy: task.createdBy,
                      deadline: task.deadline, createdAt: task.createdAt, updatedAt: task.updatedAt,
                    } as Task)
                  } else {
                    window.location.href = `/projects/${task.projectId}`
                  }
                }} className="block px-4 py-3 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{task.title}</p>
                    <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                  </div>
                  {(() => {
                    const pct = TASK_STATUS_PROGRESS[task.status] ?? 0
                    const color = pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : pct > 0 ? '#3b82f6' : '#d1d5db'
                    return (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
                      </div>
                    )
                  })()}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDirect ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                      {isDirect ? 'Direct' : task.projectName}
                    </span>
                    <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Direct Task Detail Panel */}
      {selectedDirectTask && (
        <TaskDetailPanel
          task={selectedDirectTask}
          projectId="DIRECT"
          permissions={{
            canCreateTask: isTopTier || isAdmin,
            canUpdateTask: isTopTier || isAdmin,
            canUpdateStatus: true,
            canDeleteTask: isTopTier || isAdmin,
            canAssignTask: isTopTier || isAdmin,
            canManageMembers: false,
            canDeleteProject: false,
          }}
          onClose={() => setSelectedDirectTask(null)}
        />
      )}

      {/* Assign Task Modal */}
      {showAssign && (
        <AssignModal
          users={(allUsers ?? []).filter((u) => u.systemRole === 'MEMBER' || u.systemRole === 'ADMIN')}
          isPending={createDirectTask.isPending}
          onCreate={(data) => createDirectTask.mutate(data, { onSuccess: () => setShowAssign(false) })}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  )
}

function AssignModal({
  users, isPending, onCreate, onClose,
}: {
  users: { userId: string; name: string; email: string }[]
  isPending: boolean
  onCreate: (data: { title: string; description?: string; priority: TaskPriority; deadline: string; assignedTo: string[] }) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (uid: string) => setSelected((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !deadlineDate || selected.length === 0) return
    const deadline = deadlineTime ? `${deadlineDate}T${deadlineTime}` : deadlineDate
    onCreate({ title, description: description || undefined, priority, deadline, assignedTo: selected })
  }

  return (
    <Modal isOpen onClose={onClose} title="Assign Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Task Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What needs to be done?"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Details..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none resize-none transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Priority</label>
            <Select
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Deadline</label>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={deadlineDate} onChange={setDeadlineDate} min={new Date().toISOString().slice(0, 10)} />
              <TimePicker value={deadlineTime} onChange={setDeadlineTime} placeholder="Time" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Assign To ({selected.length})</label>
          <UserMultiSelect
            users={users.map((u) => ({ userId: u.userId, name: u.name, email: u.email }))}
            selected={selected}
            onChange={setSelected}
            placeholder="Search users..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isPending} disabled={!title || !deadlineDate || selected.length === 0}>Assign Task</Button>
        </div>
      </form>
    </Modal>
  )
}
