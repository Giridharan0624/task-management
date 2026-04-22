import { apiClient } from './client'

/** Known event types the backend emits. Keep in sync with
 *  `shared_kernel/webhooks.py::ALL_EVENT_TYPES`. The UI shows these
 *  as a checkbox grid in the create/edit modal. '*' is a sentinel
 *  meaning "subscribe to everything". */
export const WEBHOOK_EVENT_TYPES = [
  'task.created',
  'task.assigned',
  'task.completed',
  'dayoff.requested',
  'dayoff.approved',
  'dayoff.rejected',
  'user.invited',
  'user.created',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENT_TYPES[number] | '*'

export interface Webhook {
  webhookId: string
  url: string
  description: string
  events: string[]
  enabled: boolean
  /** Masked preview like "abc…xyz". The full secret is only returned
   *  on the create response, never on reads. */
  secretPreview: string
  /** Only set on the create response; null otherwise. */
  secret: string | null
  createdAt: string
  updatedAt: string
}

export function listWebhooks(): Promise<{ webhooks: Webhook[] }> {
  return apiClient.get('/orgs/current/webhooks')
}

export function createWebhook(data: {
  url: string
  events: string[]
  description?: string
}): Promise<Webhook> {
  return apiClient.post('/orgs/current/webhooks', data)
}

export function updateWebhook(
  webhookId: string,
  data: {
    url?: string
    events?: string[]
    description?: string
    enabled?: boolean
  },
): Promise<Webhook> {
  return apiClient.put(`/orgs/current/webhooks/${webhookId}`, data)
}

export function deleteWebhook(webhookId: string): Promise<void> {
  return apiClient.del(`/orgs/current/webhooks/${webhookId}`)
}
