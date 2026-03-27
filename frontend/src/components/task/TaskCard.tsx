'use client'

import type { Task } from '@/types/task'
import { Badge } from '@/components/ui/Badge'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

const statusLabel: Record<Task['status'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}

const priorityLabel: Record<Task['priority'], string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const deadlineFormatted = task.deadline
    ? new Date(task.deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const isOverdue =
    task.deadline && task.status !== 'DONE' && new Date(task.deadline) < new Date()

  return (
    <button
      onClick={() => onClick(task)}
      className="w-full text-left rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={task.status}>{statusLabel[task.status]}</Badge>
          <Badge variant={task.priority}>{priorityLabel[task.priority]}</Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
          {task.assignedTo && task.assignedTo.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.assignedTo.map((userId) => (
                <span
                  key={userId}
                  className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 truncate max-w-[100px]"
                  title={userId}
                >
                  {userId}
                </span>
              ))}
            </div>
          ) : (
            <span className="italic">Unassigned</span>
          )}
          {deadlineFormatted && (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due {deadlineFormatted}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
