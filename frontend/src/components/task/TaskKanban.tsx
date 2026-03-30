'use client'

import { useState } from 'react'
import type { Task, TaskStatus } from '@/types/task'
import type { ProjectMember } from '@/types/user'
import type { Permissions } from '@/lib/hooks/usePermission'
import { TaskCard } from './TaskCard'
import { TaskDetailPanel } from './TaskDetailPanel'
import { CreateTaskModal } from './CreateTaskModal'
import { Button } from '@/components/ui/Button'

interface TaskKanbanProps {
  projectId: string
  tasks: Task[]
  permissions: Permissions
  members?: ProjectMember[]
}

const COLUMNS: { status: TaskStatus; label: string; dot: string; headerColor: string }[] = [
  { status: 'TODO', label: 'To Do', dot: 'bg-amber-400', headerColor: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' },
  { status: 'IN_PROGRESS', label: 'In Progress', dot: 'bg-blue-400', headerColor: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' },
  { status: 'DONE', label: 'Done', dot: 'bg-emerald-400', headerColor: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' },
]

export function TaskKanban({ projectId, tasks, permissions, members = [] }: TaskKanbanProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const nameMap = new Map<string, string>()
  for (const m of members) {
    nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
  }
  const resolveName = (userId: string) => nameMap.get(userId) || 'Unknown'

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status)

  return (
    <div className="flex flex-col gap-4">
      {permissions.canCreateTask && (
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateModal(true)}>Add Task</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map(({ status, label, dot, headerColor }) => {
          const columnTasks = tasksByStatus(status)
          return (
            <div key={status} className="flex flex-col gap-3 rounded-2xl bg-gray-50/80 p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${headerColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {label}
                </span>
                <span className="text-xs font-semibold text-gray-400">{columnTasks.length}</span>
              </div>

              <div className="flex flex-col gap-2 min-h-[120px]">
                {columnTasks.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">No tasks</p>
                )}
                {columnTasks.map((task) => (
                  <TaskCard key={task.taskId} task={task} onClick={setSelectedTask} resolveName={resolveName} />
                ))}
              </div>

              {status === 'TODO' && permissions.canCreateTask && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-indigo-600 transition-colors mt-1 px-1"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add task
                </button>
              )}
            </div>
          )
        })}
      </div>

      <TaskDetailPanel
        task={selectedTask}
        projectId={projectId}
        permissions={permissions}
        onClose={() => setSelectedTask(null)}
      />

      <CreateTaskModal
        projectId={projectId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
