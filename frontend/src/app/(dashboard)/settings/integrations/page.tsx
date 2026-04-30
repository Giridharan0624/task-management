'use client'

import Link from 'next/link'
import { Plug, Plus, Settings as SettingsIcon } from 'lucide-react'

import { useIntegrations } from '@/lib/hooks/useIntegrations'
import { isIntegrationsAllowed, useOrgPlan } from '@/lib/hooks/useOrgPlan'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFormat } from '@/lib/tenant/useFormat'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  CONNECTED: 'success',
  NEEDS_REAUTH: 'warning',
  PAUSED: 'default',
  DISABLED: 'default',
  ERROR: 'danger',
}

export default function IntegrationsPage() {
  const { integrations, isLoading, error } = useIntegrations()
  const { tier, isLoading: planLoading } = useOrgPlan()
  const planAllowed = isIntegrationsAllowed(tier)
  const fmt = useFormat()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect 3rd-party tools — sync tickets, contacts, and events with your TaskFlow tasks."
        action={
          planAllowed ? (
            <Link href="/settings/integrations/browse">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Browse providers
              </Button>
            </Link>
          ) : null
        }
      />

      {!planLoading && !planAllowed && (
        <Card className="p-5">
          <p className="text-sm font-medium">Integrations require a Pro plan.</p>
          <p className="mt-1 text-sm text-gray-600">
            Upgrade your workspace to connect Freshdesk and other 3rd-party tools.
          </p>
          <Link href="/settings/plan" className="mt-3 inline-block">
            <Button variant="secondary">View plans</Button>
          </Link>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <Card className="p-6 text-sm text-red-600">
          Could not load integrations: {String(error)}
        </Card>
      ) : integrations.length === 0 ? (
        <EmptyState
          icon={<Plug />}
          title="No integrations yet"
          description="Connect your first 3rd-party tool to keep tickets and tasks in sync."
          action={
            planAllowed ? (
              <Link href="/settings/integrations/browse">
                <Button>Browse providers</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {integrations.map((integration) => (
            <Card key={integration.integrationId} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{integration.displayName}</h3>
                    <Badge variant={STATUS_VARIANTS[integration.status] ?? 'default'}>
                      {integration.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Connected {fmt.date(integration.connectedAt)} · mode {integration.assigneeMode}
                  </p>
                  {integration.lastError && (
                    <p className="mt-2 text-sm text-amber-700">{integration.lastError}</p>
                  )}
                </div>
                <Link href={`/settings/integrations/${integration.integrationId}`}>
                  <Button variant="secondary">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Manage
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
