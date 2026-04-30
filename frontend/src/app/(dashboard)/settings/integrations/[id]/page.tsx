'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'

import {
  useDisconnectIntegration,
  useIntegration,
} from '@/lib/hooks/useIntegrations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useFormat } from '@/lib/tenant/useFormat'

export default function IntegrationDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
  const fmt = useFormat()

  const { integration, isLoading } = useIntegration(id)
  const disconnect = useDisconnectIntegration()

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!integration) {
    return (
      <Card className="p-6 text-sm text-red-600">
        Integration not found.
      </Card>
    )
  }

  async function handleDisconnect() {
    if (!integration) return
    const ok = await confirm({
      title: `Disconnect ${integration.displayName}?`,
      description:
        'Existing linked tasks will remain in TaskFlow. Inbound webhooks will be rejected. You can reconnect at any time.',
      confirmLabel: 'Disconnect',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await disconnect.mutateAsync(integration.integrationId)
      toast.show('Integration disconnected', 'success')
      router.push('/settings/integrations')
    } catch (e) {
      toast.show(
        e instanceof Error ? e.message : 'Could not disconnect',
        'error',
      )
    }
  }

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
        title={integration.displayName}
        description={`Provider: ${integration.provider}`}
        action={
          <Button variant="danger" onClick={handleDisconnect} disabled={disconnect.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        }
      />

      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className="mt-1"><Badge>{integration.status}</Badge></p>
          </div>
          <div>
            <p className="text-gray-500">Assignee mode</p>
            <p className="mt-1 font-medium">{integration.assigneeMode}</p>
          </div>
          <div>
            <p className="text-gray-500">Connected</p>
            <p className="mt-1 font-medium">{fmt.date(integration.connectedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Updated</p>
            <p className="mt-1 font-medium">{fmt.date(integration.updatedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Linked project</p>
            <p className="mt-1 font-medium">
              {integration.linkedProjectId || 'DIRECT (no project)'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Account</p>
            <p className="mt-1 font-medium">{integration.accountId}</p>
          </div>
        </div>

        {integration.lastError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {integration.lastError}
          </div>
        )}
      </Card>
    </div>
  )
}
