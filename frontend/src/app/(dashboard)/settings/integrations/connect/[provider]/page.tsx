'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy } from 'lucide-react'

import {
  useConnectIntegration,
  useIntegrationProviders,
} from '@/lib/hooks/useIntegrations'
import type { ConnectResponse } from '@/lib/api/integrationsApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'
import { DynamicConnectForm } from '../../_components/DynamicConnectForm'
import { FreshdeskWebhookSetupGuide } from '../../_components/FreshdeskWebhookSetupGuide'

export default function ConnectProviderPage() {
  const params = useParams<{ provider: string }>()
  const provider = params?.provider ?? ''
  const router = useRouter()
  const toast = useToast()

  const { providers, isLoading } = useIntegrationProviders()
  const connect = useConnectIntegration(provider)
  const connector = providers.find((p) => p.provider === provider)

  const [success, setSuccess] = useState<ConnectResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(form: Record<string, string>) {
    setErrorMessage(null)
    try {
      const result = await connect.mutateAsync({ form })
      setSuccess(result)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Could not connect')
    }
  }

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (!connector) {
    return (
      <Card className="p-6 text-sm text-red-600">
        Unknown provider: {provider}
      </Card>
    )
  }

  if (success) {
    const integrationsBase =
      process.env.NEXT_PUBLIC_INTEGRATIONS_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      ''
    const fullUrl = `${integrationsBase.replace(/\/$/, '')}${success.webhookUrlPath}`
    return (
      <div className="space-y-6">
        <PageHeader
          title="Connected"
          description={`${connector.displayName} is now linked to your workspace.`}
        />
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm font-medium text-gray-700">Webhook URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-gray-50 px-3 py-2 text-xs">
                {fullUrl}
              </code>
              <Button variant="secondary" onClick={() => copy(fullUrl, 'Webhook URL')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Authorization header value (shown ONCE)
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-gray-50 px-3 py-2 text-xs">
                Bearer {success.webhookSecret}
              </code>
              <Button
                variant="secondary"
                onClick={() => copy(`Bearer ${success.webhookSecret}`, 'Bearer token')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-700">
              Save this now — we never show it again. Paste it into your provider's
              webhook configuration as the <code>Authorization</code> header value.
            </p>
          </div>
          {provider === 'freshdesk' ? (
            <div className="rounded-md border border-gray-200 p-4">
              <FreshdeskWebhookSetupGuide
                webhookUrl={fullUrl}
                bearerToken={success.webhookSecret}
              />
            </div>
          ) : (
            connector.connectFormSchema.postConnectSteps?.map((step) => (
              <div key={step.title} className="rounded-md border border-gray-200 p-3">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-gray-600">{step.body}</p>
              </div>
            ))
          )}
        </Card>
        <div className="flex justify-end">
          <Button onClick={() => router.push('/settings/integrations')}>
            <Check className="mr-2 h-4 w-4" />
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings/integrations/browse"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to providers
      </Link>

      <PageHeader
        title={connector.connectFormSchema.title || `Connect ${connector.displayName}`}
        description={connector.displayName}
      />

      <Card className="p-5">
        <DynamicConnectForm
          schema={connector.connectFormSchema}
          isSubmitting={connect.isPending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
        />
      </Card>
    </div>
  )
}
