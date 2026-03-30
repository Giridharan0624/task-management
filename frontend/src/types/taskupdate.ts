export interface TaskSummaryItem {
  taskName: string
  timeRecorded: string
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
