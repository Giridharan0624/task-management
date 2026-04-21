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
  /** UTC ISO timestamp the backend stamped when it built this
   *  response. Feeds serverClock so the Timer ticks against server
   *  time, not the local OS clock. Optional — absent from old
   *  backend responses pre the clock-sync change. */
  serverTime?: string
}

export interface StartTimerData {
  taskId: string
  projectId: string
  taskTitle: string
  projectName: string
  description: string
}
