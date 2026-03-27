export type AttendanceStatus = 'SIGNED_IN' | 'SIGNED_OUT'

export interface AttendanceSession {
  signInAt: string
  signOutAt: string | null
  hours: number | null
}

export interface Attendance {
  userId: string
  date: string
  sessions: AttendanceSession[]
  totalHours: number
  currentSignInAt: string | null
  userName: string
  userEmail: string
  systemRole: string
  status: AttendanceStatus
  sessionCount: number
}
