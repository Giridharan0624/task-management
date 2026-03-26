'use client'

import { useState } from 'react'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import Link from 'next/link'
import type { MyTask } from '@/lib/api/userApi'

type FilterStatus = 'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-orange-100 text-orange-800',
  LOW: 'bg-gray-100 text-gray-600',
}

export default function MyTasksPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useMyTasks()
  const [filter, setFilter] = useState<FilterStatus>('ALL')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  const allTasks = tasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const progressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length

  const filteredTasks = filter === 'ALL' ? allTasks : allTasks.filter((t) => t.status === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-gray-500 mt-1">
          {user?.systemRole === 'ADMIN'
            ? 'Tasks assigned to you by the owner'
            : 'Tasks assigned to you'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 cursor-pointer hover:shadow-sm transition" onClick={() => setFilter('ALL')}>
          <div className="text-2xl font-bold text-indigo-700">{allTasks.length}</div>
          <div className="text-sm text-indigo-600">Total</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100 cursor-pointer hover:shadow-sm transition" onClick={() => setFilter('TODO')}>
          <div className="text-2xl font-bold text-yellow-700">{todoCount}</div>
          <div className="text-sm text-yellow-600">To Do</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 cursor-pointer hover:shadow-sm transition" onClick={() => setFilter('IN_PROGRESS')}>
          <div className="text-2xl font-bold text-blue-700">{progressCount}</div>
          <div className="text-sm text-blue-600">In Progress</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100 cursor-pointer hover:shadow-sm transition" onClick={() => setFilter('DONE')}>
          <div className="text-2xl font-bold text-green-700">{doneCount}</div>
          <div className="text-sm text-green-600">Done</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'ALL' ? 'All' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {filter === 'ALL' ? 'No tasks assigned to you yet.' : `No ${filter.replace('_', ' ').toLowerCase()} tasks.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard key={task.taskId} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: MyTask }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/boards/${task.boardId}`}
              className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {task.title}
            </Link>
            <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
          </div>
          {task.description && (
            <p className="text-sm text-gray-500 line-clamp-1 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Board: {task.boardName}</span>
            {task.dueDate && (
              <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                Due: {new Date(task.dueDate).toLocaleDateString()}
                {isOverdue && ' (Overdue)'}
              </span>
            )}
          </div>
        </div>
        <Badge className={STATUS_COLORS[task.status]}>
          {task.status.replace('_', ' ')}
        </Badge>
      </div>
    </div>
  )
}
