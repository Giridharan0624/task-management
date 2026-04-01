export type AttendanceStatus = 'SIGNED_IN' | 'SIGNED_OUT'

export interface AttendanceSession {
  signInAt: string
  signOutAt: string | null
  hours: number | null
  taskId: string | null
  projectId: string | null
  taskTitle: string | null
  projectName: string | null
  description: string | null
}

export interface CurrentTask {
  taskId: string
  projectId: string
  taskTitle: string
  projectName: string
}

export interface Attendance {
  userId: string
  date: string
  sessions: AttendanceSession[]
  totalHours: number
  currentSignInAt: string | null
  currentTask: CurrentTask | null
  userName: string
  userEmail: string
  systemRole: string
  status: AttendanceStatus
  sessionCount: number
}

export interface StartTimerData {
  taskId: string
  projectId: string
  taskTitle: string
  projectName: string
  description: string
}
