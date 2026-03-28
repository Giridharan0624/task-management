'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useDirectTasks, useCreateDirectTask } from '@/lib/hooks/useTasks'
import { useUsers } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'
import type { Task, TaskPriority } from '@/types/task'

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

export default function DirectTasksPage() {
  const { user } = useAuth()
  const systemPerms = useSystemPermission(user?.systemRole)
  const { data: tasks, isLoading } = useDirectTasks()
  const { data: allUsers } = useUsers()
  const createTask = useCreateDirectTask()
  const [showCreate, setShowCreate] = useState(false)

  // Build name resolver
  const nameMap = new Map<string, string>()
  for (const u of allUsers ?? []) nameMap.set(u.userId, u.name || u.email)
  if (user) nameMap.set(user.userId, user.name || user.email)
  const resolveName = (id: string) => nameMap.get(id) || id

  const allTasks = tasks ?? []

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Direct Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tasks assigned directly to people, outside of projects</p>
        </div>
        {systemPerms.canAssignTasks && (
          <Button onClick={() => setShowCreate(true)}>Assign New Task</Button>
        )}
      </div>

      {allTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-400 text-sm">No direct tasks yet</p>
          {systemPerms.canAssignTasks && (
            <button onClick={() => setShowCreate(true)} className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
              Assign your first task
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {allTasks.map((task: Task) => (
            <div key={task.taskId} className="px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                  {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                    <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                    <span className="text-xs text-gray-400">
                      Due {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {task.assignedTo.map((uid) => (
                      <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        {resolveName(uid)}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">by {resolveName(task.createdBy)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDirectTaskModal
          users={(allUsers ?? []).filter((u) => u.systemRole === 'MEMBER' || u.systemRole === 'ADMIN')}
          isPending={createTask.isPending}
          onCreate={(data) => {
            createTask.mutate(data, { onSuccess: () => setShowCreate(false) })
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function CreateDirectTaskModal({
  users,
  isPending,
  onCreate,
  onClose,
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
    <Modal isOpen onClose={onClose} title="Assign Direct Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Task Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What needs to be done?" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Details..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none resize-none transition-all" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Deadline</label>
            <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Assign To ({selected.length} selected)</label>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
            {users.map((u) => {
              const isSelected = selected.includes(u.userId)
              return (
                <label key={u.userId} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}>
                  <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(u.userId)} className="sr-only" />
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
