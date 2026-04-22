'use client'

import type { Task, TaskStatus } from '@/types/task'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { useFormat } from '@/lib/tenant/useFormat'

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  resolveName?: (userId: string) => string
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-gray-300',
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  HIGH: 'High',
  MEDIUM: 'Med',
  LOW: 'Low',
}

export function TaskCard({ task, onClick, resolveName }: TaskCardProps) {
  const resolve = resolveName ?? ((id: string) => id)
  const fmt = useFormat()

  const deadlineFormatted = task.deadline
    ? fmt.date(task.deadline, { month: 'short', day: 'numeric' })
    : null

  const isOverdue = checkOverdue(task.deadline, task.status)

  return (
    <button
      onClick={() => onClick(task)}
      className="group w-full text-left rounded-lg border border-border bg-muted/30 p-3 hover:bg-card hover:border-border/80 hover:shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* Title */}
      <p className="text-[13px] font-medium text-foreground/95 leading-snug line-clamp-2 group-hover:text-gray-950 transition-colors">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2">
        {/* Priority dot */}
        <span className="flex items-center gap-1" title={`${PRIORITY_LABEL[task.priority]} priority`}>
          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
          <span className="text-[10px] text-muted-foreground/70 font-medium">{PRIORITY_LABEL[task.priority]}</span>
        </span>

        {/* Deadline */}
        {deadlineFormatted && (
          <>
            <span className="text-gray-200">|</span>
            <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-muted-foreground/70'}`}>
              {isOverdue && (
                <svg className="w-3 h-3 inline mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
              )}
              {deadlineFormatted}
            </span>
          </>
        )}
      </div>

      {/* Assignees */}
      {task.assignedTo && task.assignedTo.length > 0 && (
        <div className="flex items-center gap-1 mt-2.5">
          {task.assignedTo.slice(0, 3).map((userId) => {
            const name = resolve(userId)
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <span
                key={userId}
                className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-1 ring-white"
                title={name}
                style={{ width: 22, height: 22 }}
              >
                {initials}
              </span>
            )
          })}
          {task.assignedTo.length > 3 && (
            <span className="text-[10px] text-muted-foreground/70 font-medium ml-0.5">+{task.assignedTo.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}
