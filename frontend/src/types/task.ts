export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
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
  createdAt: string
  updatedAt: string
}
