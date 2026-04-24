'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  Webhook as WebhookIcon,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  updateWebhook,
  WEBHOOK_EVENT_TYPES,
  type Webhook,
} from '@/lib/api/webhooksApi'
import { useFormat } from '@/lib/tenant/useFormat'
import { PageHeader } from '@/components/ui/PageHeader'
import { BackToSettings } from '@/components/settings/BackToSettings'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

/**
 * Webhook registrations for the current org. OWNER-gated (the backend
 * also enforces SETTINGS_EDIT).
 *
 * Lifecycle surfaces:
 *   - List — each webhook shows URL, enabled toggle, event count,
 *     masked secret, created-date. Delete via row menu.
 *   - Create — modal with URL + events multi-select + description.
 *     After submit, the secret is revealed ONCE with a copy-to-
 *     clipboard button; subsequent reads only show a masked preview.
 *   - Edit — same shape minus the secret (already issued; regenerate
 *     is a future feature).
 */
export default function WebhooksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const fmt = useFormat()

  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await listWebhooks()
      setWebhooks(res.webhooks ?? [])
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : 'Could not load webhooks.',
      )
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.systemRole !== 'OWNER') return
    void refresh()
  }, [user, refresh])

  if (!user || user.systemRole !== 'OWNER') return null

  const editing = editingId
    ? webhooks?.find((w) => w.webhookId === editingId) ?? null
    : null

  const onToggle = async (wh: Webhook) => {
    setTogglingId(wh.webhookId)
    try {
      await updateWebhook(wh.webhookId, { enabled: !wh.enabled })
      toast.success(wh.enabled ? 'Webhook disabled.' : 'Webhook enabled.')
      await refresh()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not update webhook.',
      )
    } finally {
      setTogglingId(null)
    }
  }

  const onDelete = async (wh: Webhook) => {
    const ok = await confirm({
      title: 'Delete webhook?',
      description: `Subscriber at ${wh.url} will stop receiving events. This cannot be undone.`,
      confirmLabel: 'Delete webhook',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteWebhook(wh.webhookId)
      toast.success('Webhook removed.')
      await refresh()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not delete webhook.',
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-24 animate-fade-in">
      <BackToSettings />
      <PageHeader
        title="Webhooks"
        description="Register HTTPS endpoints that receive signed events when something happens in this workspace."
        actions={
          <Button
            onClick={() => {
              setEditingId(null)
              setRevealedSecret(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add webhook
          </Button>
        }
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">
              Every delivery is signed.
            </p>
            <p className="mt-0.5">
              Each POST carries{' '}
              <code className="rounded bg-muted/60 px-1 font-mono">
                X-TaskFlow-Signature: t=&lt;ts&gt;,v1=&lt;hmac&gt;
              </code>
              , where the HMAC is computed from{' '}
              <code className="rounded bg-muted/60 px-1 font-mono">
                HMAC_SHA256(secret, &quot;{'{ts}'}.{'{body}'}&quot;)
              </code>
              . Reject requests whose signature doesn&apos;t match — the
              same shape as Stripe&apos;s webhook signing.
            </p>
          </div>
        </div>
      </Card>

      {webhooks === null ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Spinner size="sm" /> Loading webhooks...
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <WebhookIcon className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            No webhooks yet
          </h2>
          <p className="max-w-sm text-xs text-muted-foreground">
            Subscribe an HTTPS endpoint to receive real-time events
            from this workspace — tasks created, assignees added,
            day-offs approved, and more.
          </p>
          <Button
            onClick={() => {
              setEditingId(null)
              setRevealedSecret(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Register your first webhook
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {webhooks.map((wh) => (
            <Card key={wh.webhookId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={wh.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 truncate font-mono text-sm font-semibold text-foreground hover:underline"
                    >
                      {wh.url}
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <Badge
                      tone={wh.enabled ? 'success' : 'neutral'}
                      size="sm"
                    >
                      {wh.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  {wh.description && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {wh.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {wh.events.map((e) => (
                      <Badge key={e} tone="neutral" size="sm">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <KeyRound className="h-3 w-3" />
                    <code className="font-mono">{wh.secretPreview}</code>
                    <span>· registered {fmt.date(wh.createdAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(wh)}
                    loading={togglingId === wh.webhookId}
                  >
                    {wh.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(wh.webhookId)
                      setRevealedSecret(null)
                      setModalOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(wh)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <WebhookFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingId(null)
          setRevealedSecret(null)
        }}
        editing={editing}
        onCreated={async (wh) => {
          setRevealedSecret(wh.secret ?? null)
          await refresh()
        }}
        onUpdated={async () => {
          await refresh()
          setModalOpen(false)
        }}
        revealedSecret={revealedSecret}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────

interface WebhookFormModalProps {
  open: boolean
  onClose: () => void
  editing: Webhook | null
  onCreated: (wh: Webhook) => void
  onUpdated: () => void
  revealedSecret: string | null
}

function WebhookFormModal({
  open,
  onClose,
  editing,
  onCreated,
  onUpdated,
  revealedSecret,
}: WebhookFormModalProps) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['*'])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setUrl(editing.url)
      setEvents(editing.events)
      setDescription(editing.description || '')
    } else {
      setUrl('')
      setEvents(['*'])
      setDescription('')
    }
    setError(null)
  }, [open, editing])

  const toggleEvent = (e: string) => {
    setEvents((prev) => {
      // Selecting a specific event clears the wildcard; selecting
      // '*' clears every other event.
      if (e === '*') return prev.includes('*') ? [] : ['*']
      const next = prev.filter((x) => x !== '*')
      return next.includes(e) ? next.filter((x) => x !== e) : [...next, e]
    })
  }

  const canSubmit =
    url.trim().startsWith('https://') &&
    events.length > 0 &&
    !submitting

  const onSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      if (editing) {
        await updateWebhook(editing.webhookId, {
          url: url.trim(),
          events,
          description: description.trim(),
        })
        toast.success('Webhook updated.')
        onUpdated()
      } else {
        const created = await createWebhook({
          url: url.trim(),
          events,
          description: description.trim(),
        })
        toast.success('Webhook registered.')
        onCreated(created)
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save webhook.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {revealedSecret
              ? 'Webhook registered'
              : editing
                ? 'Edit webhook'
                : 'Register webhook'}
          </DialogTitle>
        </DialogHeader>

        {revealedSecret ? (
          <SecretRevealPane
            secret={revealedSecret}
            onClose={onClose}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label="Subscriber URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/taskflow-events"
              hint="Must start with https://. The endpoint should respond 2xx within 5 seconds; non-2xx deliveries are dropped."
              autoFocus={!editing}
            />

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Events
              </label>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={events.includes('*')}
                    onChange={() => toggleEvent('*')}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-foreground">
                    All events (*)
                  </span>
                </label>
                <div className="mt-2 grid grid-cols-1 gap-1 border-t border-border pt-2 sm:grid-cols-2">
                  {WEBHOOK_EVENT_TYPES.map((e) => (
                    <label
                      key={e}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={events.includes(e) || events.includes('*')}
                        disabled={events.includes('*')}
                        onChange={() => toggleEvent(e)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                      />
                      <code className="font-mono text-muted-foreground">
                        {e}
                      </code>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Input
              label="Description (optional)"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this endpoint does — for your reference"
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={onSubmit}
                loading={submitting}
                disabled={!canSubmit}
              >
                {editing ? 'Save changes' : 'Register webhook'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecretRevealPane({
  secret,
  onClose,
}: {
  secret: string
  onClose: () => void
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      toast.success('Secret copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Clipboard unavailable. Copy manually.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong className="font-semibold">Copy this secret now.</strong>{' '}
          It will never be shown again in full. TaskFlow stores it to
          sign deliveries, but you need it to verify signatures on your
          side.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Signing secret
        </p>
        <code className="block break-all font-mono text-xs text-foreground">
          {secret}
        </code>
      </div>

      <Button onClick={onCopy}>
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy secret
          </>
        )}
      </Button>

      <Button variant="secondary" onClick={onClose}>
        I&apos;ve saved it — close
      </Button>
    </div>
  )
}
