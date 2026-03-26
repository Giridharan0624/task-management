'use client'

import { useMyTasks } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

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
  const { data: tasks, isLoading } = useMyTasks()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  const todoTasks = (tasks ?? []).filter((t) => t.status === 'TODO')
  const inProgressTasks = (tasks ?? []).filter((t) => t.status === 'IN_PROGRESS')
  const doneTasks = (tasks ?? []).filter((t) => t.status === 'DONE')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-gray-500 mt-1">Tasks assigned to you across all boards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{(tasks ?? []).length}</div>
          <div className="text-sm text-indigo-600">Total</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-700">{todoTasks.length}</div>
          <div className="text-sm text-yellow-600">To Do</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{inProgressTasks.length}</div>
          <div className="text-sm text-blue-600">In Progress</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="text-2xl font-bold text-green-700">{doneTasks.length}</div>
          <div className="text-sm text-green-600">Done</div>
        </div>
      </div>

      {/* Task list */}
      {(tasks ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Board</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(tasks ?? []).map((task) => (
                <tr key={task.taskId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/boards/${task.boardId}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{task.boardName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={STATUS_COLORS[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={PRIORITY_COLORS[task.priority]}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
