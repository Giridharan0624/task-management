'use client'

import type { Task } from '@/types/task'
import { Badge } from '@/components/ui/Badge'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  resolveName?: (userId: string) => string
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

export function TaskCard({ task, onClick, resolveName }: TaskCardProps) {
  const resolve = resolveName ?? ((id: string) => id)

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
      className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 shadow-card hover:shadow-card-hover hover:border-indigo-200/60 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 hover-lift"
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{task.title}</p>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={task.status}>{statusLabel[task.status]}</Badge>
          <Badge variant={task.priority}>{priorityLabel[task.priority]}</Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mt-0.5">
          {task.assignedTo && task.assignedTo.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.assignedTo.map((userId) => (
                <span
                  key={userId}
                  className="inline-flex items-center rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 truncate max-w-[120px]"
                  title={resolve(userId)}
                >
                  {resolve(userId)}
                </span>
              ))}
            </div>
          ) : (
            <span className="italic text-gray-300">Unassigned</span>
          )}
          {deadlineFormatted && (
            <span className={isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}>
              {deadlineFormatted}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
