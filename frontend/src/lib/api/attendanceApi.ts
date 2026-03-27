import { apiClient } from './client'
import type { Attendance, StartTimerData } from '@/types/attendance'

export function signInToWork(data?: StartTimerData): Promise<Attendance> {
  return apiClient.post<Attendance>('/attendance/sign-in', data ?? {})
}

export function signOutFromWork(): Promise<Attendance> {
  return apiClient.put<Attendance>('/attendance/sign-out', {})
}

export function getMyAttendance(): Promise<Attendance | null> {
  return apiClient.get<Attendance | null>('/attendance/me')
}

export function getTodayAttendance(): Promise<Attendance[]> {
  return apiClient.get<Attendance[]>('/attendance/today')
}

export function getAttendanceReport(startDate: string, endDate: string): Promise<Attendance[]> {
  return apiClient.get<Attendance[]>(`/attendance/report?startDate=${startDate}&endDate=${endDate}`)
}
