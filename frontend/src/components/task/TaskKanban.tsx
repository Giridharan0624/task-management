'use client'

import { useState } from 'react'
import type { Task, TaskStatus } from '@/types/task'
import type { Permissions } from '@/lib/hooks/usePermission'
import { TaskCard } from './TaskCard'
import { TaskDetailPanel } from './TaskDetailPanel'
import { CreateTaskModal } from './CreateTaskModal'
import { Button } from '@/components/ui/Button'

interface TaskKanbanProps {
  boardId: string
  tasks: Task[]
  permissions: Permissions
}

const COLUMNS: { status: TaskStatus; label: string; headerColor: string }[] = [
  { status: 'TODO', label: 'To Do', headerColor: 'bg-gray-100 text-gray-700' },
  { status: 'IN_PROGRESS', label: 'In Progress', headerColor: 'bg-blue-100 text-blue-700' },
  { status: 'DONE', label: 'Done', headerColor: 'bg-green-100 text-green-700' },
]

export function TaskKanban({ boardId, tasks, permissions }: TaskKanbanProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
        {COLUMNS.map(({ status, label, headerColor }) => {
          const columnTasks = tasksByStatus(status)
          return (
            <div key={status} className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
              {/* Column header */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${headerColor}`}
                >
                  {label}
                </span>
                <span className="text-sm font-medium text-gray-400">{columnTasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[120px]">
                {columnTasks.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">No tasks</p>
                )}
                {columnTasks.map((task) => (
                  <TaskCard key={task.taskId} task={task} onClick={setSelectedTask} />
                ))}
              </div>

              {/* Add task in TODO column */}
              {status === 'TODO' && permissions.canCreateTask && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors mt-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        boardId={boardId}
        permissions={permissions}
        onClose={() => setSelectedTask(null)}
      />

      <CreateTaskModal
        boardId={boardId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
