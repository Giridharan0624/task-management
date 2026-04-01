import { apiClient } from './client'
import type { DayOffRequest } from '@/types/dayoff'

export function createDayOff(data: { startDate: string; endDate: string; reason: string }): Promise<DayOffRequest> {
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

export function approveDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/approve`, {})
}

export function rejectDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/reject`, {})
}

export function forwardDayOff(requestId: string, forwardToId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/forward`, { forwardToId })
}

export function cancelDayOff(requestId: string): Promise<DayOffRequest> {
  return apiClient.put<DayOffRequest>(`/day-offs/${requestId}/cancel`, {})
}
