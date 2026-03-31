export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DEVELOPED' | 'TESTING' | 'TESTED' | 'DEBUGGING' | 'FINAL_TESTING' | 'DONE'

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DEVELOPED', label: 'Developed' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'TESTED', label: 'Tested' },
  { value: 'DEBUGGING', label: 'Debugging' },
  { value: 'FINAL_TESTING', label: 'Final Testing' },
  { value: 'DONE', label: 'Done' },
]

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DEVELOPED: 'Developed',
  TESTING: 'Testing',
  TESTED: 'Tested',
  DEBUGGING: 'Debugging',
  FINAL_TESTING: 'Final Testing',
  DONE: 'Done',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  DEVELOPED: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  TESTING: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  TESTED: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  DEBUGGING: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  FINAL_TESTING: 'bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
}

export const TASK_STATUS_PROGRESS: Record<TaskStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 15,
  DEVELOPED: 35,
  TESTING: 50,
  TESTED: 65,
  DEBUGGING: 50,
  FINAL_TESTING: 80,
  DONE: 100,
}
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Task {
  taskId: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string[]
  assignedBy?: string
  createdBy: string
  deadline: string
  estimatedHours?: number
  createdAt: string
  updatedAt: string
}
