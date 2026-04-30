'use client'

import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Props {
  webhookUrl: string
  bearerToken: string
}

const SAMPLE_BODY = `{
  "ticket_id": "{{ticket.id}}",
  "event": "{{Triggered event}}",
  "subdomain": "{{helpdesk_name}}",
  "updated_at": "{{ticket.updated_at}}"
}`

/**
 * Step-by-step Workflow Automator setup. Shown after a successful connect
 * for the Freshworks provider — the platform's `post_connect_steps` list
 * gives the high-level sentence; this richer component walks the admin
 * through each click in their Freshdesk admin UI.
 */
export function FreshdeskWebhookSetupGuide({
  webhookUrl,
  bearerToken,
}: Props) {
  const toast = useToast()

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text)
    toast.show(`${label} copied`, 'success')
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">Configure Workflow Automator</p>
      <ol className="list-decimal space-y-3 pl-5 text-gray-700">
        <li>
          Open Freshdesk &rarr; <strong>Admin</strong> &rarr; <strong>Workflows</strong> &rarr; <strong>Automator</strong>.
        </li>
        <li>
          Click <strong>New Rule</strong> on the <em>Ticket Updates</em> tab.
        </li>
        <li>
          Set the trigger to <strong>Ticket is created or updated</strong>.
        </li>
        <li>
          Under <strong>Action</strong>, choose <strong>Trigger Webhook</strong>.
        </li>
        <li>
          Paste the URL into the <strong>URL</strong> field:
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-50 px-3 py-2 text-xs">
              {webhookUrl}
            </code>
            <Button variant="secondary" onClick={() => copy(webhookUrl, 'URL')}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </li>
        <li>
          Set <strong>Request type</strong> to <strong>POST</strong> and <strong>Encoding</strong> to <strong>JSON</strong>.
        </li>
        <li>
          Add a custom header named <code>Authorization</code> with this value:
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-50 px-3 py-2 text-xs">
              Bearer {bearerToken}
            </code>
            <Button
              variant="secondary"
              onClick={() => copy(`Bearer ${bearerToken}`, 'Bearer token')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </li>
        <li>
          Set the <strong>body</strong> to:
          <div className="mt-2 flex items-start gap-2">
            <pre className="flex-1 whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-xs">
              {SAMPLE_BODY}
            </pre>
            <Button variant="secondary" onClick={() => copy(SAMPLE_BODY, 'Body')}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </li>
        <li>Save the rule. New tickets and updates now reach TaskFlow.</li>
      </ol>
    </div>
  )
}
