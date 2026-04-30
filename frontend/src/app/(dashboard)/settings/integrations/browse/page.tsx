'use client'

import Link from 'next/link'
import { ArrowLeft, Plug } from 'lucide-react'

import { useIntegrationProviders } from '@/lib/hooks/useIntegrations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export default function IntegrationsBrowsePage() {
  const { providers, isLoading, error } = useIntegrationProviders()

  return (
    <div className="space-y-6">
      <Link
        href="/settings/integrations"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to integrations
      </Link>

      <PageHeader
        title="Browse providers"
        description="Pick a 3rd-party tool to connect. Each connector follows the same shape — TaskFlow adapts to the provider's existing API."
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <Card className="p-6 text-sm text-red-600">
          Could not load providers: {String(error)}
        </Card>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={<Plug />}
          title="No providers available"
          description="Your administrator hasn't installed any connectors yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <Link
              key={provider.provider}
              href={`/settings/integrations/connect/${provider.provider}`}
              className="block"
            >
              <Card className="p-5 transition hover:border-blue-500 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{provider.displayName}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Auth: {provider.authMethod.replace('_', ' ').toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {provider.capabilities.map((cap) => (
                    <Badge key={cap} variant="default">
                      {cap.replace('_', ' ').toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
