'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  integrationsApi,
  type AssigneeMode,
  type Integration,
  type Provider,
} from '@/lib/api/integrationsApi'

const PROVIDERS_KEY = ['integrations', 'providers'] as const
const INTEGRATIONS_KEY = ['integrations'] as const

export function useIntegrationProviders() {
  const query = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => integrationsApi.listProviders(),
    staleTime: 5 * 60_000,
  })
  return {
    ...query,
    providers: (query.data?.providers ?? []) as Provider[],
  }
}

export function useIntegrations() {
  const query = useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: () => integrationsApi.list(),
    staleTime: 30_000,
  })
  return {
    ...query,
    integrations: (query.data?.integrations ?? []) as Integration[],
  }
}

export function useIntegration(id: string | null) {
  const query = useQuery({
    queryKey: [...INTEGRATIONS_KEY, id],
    queryFn: () => integrationsApi.get(id as string),
    enabled: !!id,
    staleTime: 15_000,
  })
  return { ...query, integration: query.data?.integration ?? null }
}

export function useConnectIntegration(provider: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      form: Record<string, string>
      assigneeMode?: AssigneeMode
      fallbackAssigneeId?: string | null
      linkedProjectId?: string | null
    }) => integrationsApi.connect(provider, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY })
    },
  })
}

export function useDisconnectIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => integrationsApi.disconnect(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INTEGRATIONS_KEY })
    },
  })
}
