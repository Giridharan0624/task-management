import { apiClient } from './client'

export interface ServerNotification {
  notifId: string
  type: string
  title: string
  message: string
  link: string
  readAt: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

export function listNotifications(params: {
  unreadOnly?: boolean
  limit?: number
} = {}): Promise<{ notifications: ServerNotification[] }> {
  const qs = new URLSearchParams()
  if (params.unreadOnly) qs.set('unread_only', 'true')
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiClient.get(`/users/me/notifications${suffix}`)
}

export function markNotificationRead(notifId: string): Promise<{ found: boolean }> {
  return apiClient.post('/users/me/notifications', {
    action: 'mark_read',
    notif_id: notifId,
  })
}

export function markAllNotificationsRead(): Promise<{ markedRead: number }> {
  return apiClient.post('/users/me/notifications', {
    action: 'mark_all_read',
  })
}
