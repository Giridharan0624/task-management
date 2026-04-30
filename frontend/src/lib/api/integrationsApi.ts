import { integrationsApiClient } from './client'

// NOTE: the response shape on the wire is snake_case but the apiClient
// auto-transforms snake -> camel. The types below reflect what the UI
// actually sees AFTER the transform. Request bodies are sent as-is and
// transformed in the OPPOSITE direction by the client (camel -> snake).

export type AuthMethod = 'API_KEY' | 'OAUTH2' | 'BASIC' | 'WEBHOOK_ONLY'

export type Capability =
  | 'READ_ITEMS'
  | 'WRITE_ITEMS'
  | 'RECEIVE_WEBHOOKS'
  | 'OAUTH_CALLBACK'

export type IntegrationStatus =
  | 'CONNECTED'
  | 'NEEDS_REAUTH'
  | 'PAUSED'
  | 'DISABLED'
  | 'ERROR'

export type AssigneeMode = 'STRICT' | 'FALLBACK' | 'AUTO_INVITE'

export interface ConnectFormFieldOption {
  value: string
  label: string
}

export interface ConnectFormField {
  name: string
  label: string
  type: 'text' | 'password' | 'select'
  placeholder?: string
  help?: string
  required?: boolean
  pattern?: string
  secret?: boolean
  default?: string
  options?: ConnectFormFieldOption[]
}

export interface ConnectFormSchema {
  title: string
  description?: string
  fields: ConnectFormField[]
  postConnectSteps?: { title: string; body: string }[]
}

export interface Provider {
  provider: string
  displayName: string
  authMethod: AuthMethod
  capabilities: Capability[]
  connectFormSchema: ConnectFormSchema
}

export interface Integration {
  integrationId: string
  provider: string
  displayName: string
  accountId: string
  status: IntegrationStatus
  assigneeMode: AssigneeMode
  fallbackAssigneeId: string | null
  linkedProjectId: string | null
  lastError: string | null
  connectedAt: string
  connectedBy: string
  updatedAt: string
}

export interface ConnectResponse {
  integration: Integration
  webhookSecret: string
  webhookUrlPath: string
}

export const integrationsApi = {
  listProviders: (): Promise<{ providers: Provider[] }> =>
    integrationsApiClient.get('/integrations/providers'),

  list: (): Promise<{ integrations: Integration[] }> =>
    integrationsApiClient.get('/integrations'),

  get: (id: string): Promise<{ integration: Integration }> =>
    integrationsApiClient.get(`/integrations/${id}`),

  connect: (
    provider: string,
    body: {
      form: Record<string, string>
      assigneeMode?: AssigneeMode
      fallbackAssigneeId?: string | null
      linkedProjectId?: string | null
    },
  ): Promise<ConnectResponse> => integrationsApiClient.post(`/integrations/${provider}`, body),

  disconnect: (id: string): Promise<{ status: 'disconnected' }> =>
    integrationsApiClient.del(`/integrations/${id}`),
}
