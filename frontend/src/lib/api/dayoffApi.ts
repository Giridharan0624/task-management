import { apiClient } from './client'
import type { DayOffBalance, DayOffRequest } from '@/types/dayoff'

export function createDayOff(data: {
  startDate: string
  endDate: string
  reason: string
  leaveTypeId: string
}): Promise<DayOffRequest> {
  return apiClient.post<DayOffRequest>('/day-offs', data)
}

export function getMyDayOffs(): Promise<DayOffRequest[]> {
  return apiClient.get<DayOffRequest[]>('/day-offs/my')
}

export function getPendingDayOffs(): Promise<DayOffRequest[]> {
  return apiClient.get<DayOffRequest[]>('/day-offs/pending')
}

export function getAllDayOffs(): Promise<DayOffRequest[]> {
  return apiClient.get<DayOffRequest[]>('/day-offs/all')
}

export function getDayOffBalance(year?: number): Promise<DayOffBalance> {
  // Collapsed onto /day-offs/my via ?view=balance to stay under the
  // backend stack's CFN resource cap. The Lambda dispatches on the
  // query param.
  const yearQs = year ? `&year=${year}` : ''
  return apiClient.get<DayOffBalance>(`/day-offs/my?view=balance${yearQs}`)
}

export function approveDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/approve`, {})
}

export function rejectDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/reject`, {})
}

export function cancelDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/cancel`, {})
}
