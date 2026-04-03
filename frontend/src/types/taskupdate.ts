import type { Attendance } from './attendance'

export interface TaskSummaryItem {
  taskName: string
  timeRecorded: string
  description?: string
}

export interface TaskUpdate {
  updateId: string
  userId: string
  userName: string
  employeeId?: string
  date: string
  signIn: string
  signOut: string
  taskSummary: TaskSummaryItem[]
  totalTime: string
  createdAt: string
}

export interface PendingTaskUpdate {
  pendingDate: string
  submitted: false
  attendance: Attendance
}
