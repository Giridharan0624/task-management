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
  const dueDateFormatted = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const isOverdue =
    task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date()

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
          {task.assignedTo ? (
            <span className="truncate max-w-[120px]" title={task.assignedTo}>
              {task.assignedTo}
            </span>
          ) : (
            <span className="italic">Unassigned</span>
          )}
          {dueDateFormatted && (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due {dueDateFormatted}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
