'use client'

import { useState } from 'react'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useCreateDirectTask } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'
import { DatePicker } from '@/components/ui/DatePicker'
import Link from 'next/link'
import type { MyTask } from '@/lib/api/userApi'
import type { TaskPriority } from '@/types/task'

type FilterStatus = 'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'
type TabType = 'my' | 'all'

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 border border-orange-200',
  LOW: 'bg-slate-50 text-slate-600 border border-slate-200',
}

const TOP_TIER = ['OWNER', 'CEO', 'MD']

export default function TasksPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useMyTasks()
  const { data: allUsers } = useUsers()
  const systemPerms = useSystemPermission(user?.systemRole)
  const createDirectTask = useCreateDirectTask()
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [activeTab, setActiveTab] = useState<TabType>('my')
  const [showAssign, setShowAssign] = useState(false)
  const [search, setSearch] = useState('')

  const isTopTier = TOP_TIER.includes(user?.systemRole ?? '')
  const isAdmin = user?.systemRole === 'ADMIN'
  const isMember = user?.systemRole === 'MEMBER'
  const showTabs = isAdmin // Only admins get two tabs

  // Name resolver
  const nameMap = new Map<string, string>()
  for (const u of allUsers ?? []) nameMap.set(u.userId, u.name || u.email)
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

  const todoCount = visibleTasks.filter((t) => t.status === 'TODO').length
  const progressCount = visibleTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = visibleTasks.filter((t) => t.status === 'DONE').length

  let filteredTasks = filter === 'ALL' ? visibleTasks : visibleTasks.filter((t) => t.status === filter)
  if (search.trim()) {
    const q = search.toLowerCase()
    filteredTasks = filteredTasks.filter((t) =>
      t.title.toLowerCase().includes(q) || (t.projectName || '').toLowerCase().includes(q)
    )
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade">
        {([
          { key: 'ALL' as FilterStatus, label: 'Total', value: visibleTasks.length, active: 'border-indigo-200 bg-indigo-50 shadow-sm', text: 'text-indigo-700' },
          { key: 'TODO' as FilterStatus, label: 'To Do', value: todoCount, active: 'border-amber-200 bg-amber-50 shadow-sm', text: 'text-amber-700' },
          { key: 'IN_PROGRESS' as FilterStatus, label: 'In Progress', value: progressCount, active: 'border-blue-200 bg-blue-50 shadow-sm', text: 'text-blue-700' },
          { key: 'DONE' as FilterStatus, label: 'Done', value: doneCount, active: 'border-emerald-200 bg-emerald-50 shadow-sm', text: 'text-emerald-700' },
        ]).map(({ key, label, value, active, text }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-2xl p-3 sm:p-4 border text-left transition-all duration-200 ${
              filter === key ? active : 'border-gray-100 bg-white hover:shadow-card shadow-card'
            }`}
          >
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${text}`}>{value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks by title or project..."
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none transition-all hover:border-gray-300"
        />
      </div>

      {/* Task Table */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">
            {filter === 'ALL' ? 'No tasks found.' : `No ${filter.replace('_', ' ').toLowerCase()} tasks.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
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
                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTasks.map((task) => {
                const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'DONE'
                const isDirect = task.projectId === 'DIRECT'
                return (
                  <tr key={task.taskId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={isDirect ? '/my-tasks' : `/projects/${task.projectId}`}
                        className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {task.title}
                      </Link>
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
                        {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {isOverdue && ' !'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
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
              const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'DONE'
              const isDirect = task.projectId === 'DIRECT'
              return (
                <Link key={task.taskId} href={isDirect ? '/my-tasks' : `/projects/${task.projectId}`} className="block px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{task.title}</p>
                    <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDirect ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                      {isDirect ? 'Direct' : task.projectName}
                    </span>
                    <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                    <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
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
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (uid: string) => setSelected((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !deadlineDate || selected.length === 0) return
    onCreate({ title, description: description || undefined, priority, deadline: deadlineDate, assignedTo: selected })
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
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Deadline</label>
            <DatePicker value={deadlineDate} onChange={setDeadlineDate} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Assign To ({selected.length})</label>
          <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
            {users.map((u) => {
              const isSel = selected.includes(u.userId)
              return (
                <label key={u.userId} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${isSel ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}>
                  <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 transition-all ${isSel ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {isSel && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(u.userId)} className="sr-only" />
                  <Avatar name={u.name} size="sm" />
                  <span className="text-sm text-gray-900">{u.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{u.email}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isPending} disabled={!title || !deadlineDate || selected.length === 0}>Assign Task</Button>
        </div>
      </form>
    </Modal>
  )
}
