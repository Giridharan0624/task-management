'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Search,
  UserCog,
  X,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import type { AuditEvent } from '@/types/org'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

const ACTION_FILTERS: { label: string; prefix: string }[] = [
  { label: 'All', prefix: '' },
  { label: 'Roles', prefix: 'role.' },
  { label: 'Settings', prefix: 'settings.' },
  { label: 'Users', prefix: 'user.' },
  { label: 'Pipelines', prefix: 'pipeline.' },
  { label: 'Organization', prefix: 'org.' },
  { label: 'Plan', prefix: 'plan.' },
  { label: 'Webhooks', prefix: 'webhook.' },
  { label: 'Platform', prefix: 'platform.' },
]

/** Human-friendly labels for known action strings. Keys match the
 *  constants in `shared_kernel/audit.py` + ad-hoc action strings
 *  used by newer handlers (webhooks, platform admin, MFA reset).
 *  Falls back to the raw action name when no mapping exists so the
 *  viewer never hides an event — just reveals it unmapped. */
const ACTION_LABEL: Record<string, string> = {
  // Roles
  'role.created': 'Role created',
  'role.updated': 'Role updated',
  'role.deleted': 'Role deleted',
  // Settings
  'settings.updated': 'Settings updated',
  // Users
  'user.invited': 'User invited',
  'user.created': 'User created',
  'user.role_changed': 'User role changed',
  'user.deleted': 'User deleted',
  'user.suspended': 'User suspended',
  'user.mfa_reset': '2FA reset',
  // Pipelines
  'pipeline.created': 'Pipeline created',
  'pipeline.updated': 'Pipeline updated',
  'pipeline.deleted': 'Pipeline deleted',
  // Org lifecycle
  'org.suspended': 'Workspace suspended',
  'org.resumed': 'Workspace resumed',
  'org.deleted': 'Workspace deletion scheduled',
  'org.ownership_transferred': 'Ownership transferred',
  'org.exported': 'Workspace data exported',
  // Plan
  'plan.upgraded': 'Plan upgraded',
  'plan.downgraded': 'Plan downgraded',
  // Webhooks (Session 5)
  'webhook.created': 'Webhook registered',
  'webhook.updated': 'Webhook updated',
  'webhook.deleted': 'Webhook removed',
  // Platform operator
  'platform.features_updated': 'Features toggled by platform operator',
}

function labelForAction(action: string): string {
  return ACTION_LABEL[action] || action
}

export default function AuditLogPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user && user.systemRole !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [user, router])

  const fetchPage = async (startCursor: string | null, reset: boolean) => {
    try {
      setError(null)
      if (reset) setLoading(true)
      else setLoadingMore(true)
      const res = await orgsApi.listAudit({
        cursor: startCursor,
        action: actionFilter || null,
      })
      setEvents((prev) => (reset ? res.events : [...prev, ...res.events]))
      setNextCursor(res.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Re-fetch when the action filter changes.
  useEffect(() => {
    setCursor(null)
    fetchPage(null, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? events.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.actorEmail.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.targetId.toLowerCase().includes(q),
      )
    : events

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Audit log"
        description="Who changed what in this workspace. Covers settings, roles, pipelines, users, plan."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes('404') && (
              <p className="mt-1 text-xs opacity-80">
                The audit endpoint is built but not yet wired in CDK.
                It activates after the nested-stack refactor.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.prefix}
              type="button"
              onClick={() => setActionFilter(f.prefix)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                actionFilter === f.prefix
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <Input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
            rightIcon={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="pointer-events-auto rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : undefined
            }
            className="h-9"
          />
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center px-5 py-12 text-sm text-muted-foreground">
          Loading...
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {search ? 'No events match your search' : 'No audit events yet'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {search
                ? 'Try a different search term or filter.'
                : 'Changes to settings, roles, and users will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 hover-lift-sm">
          <ul className="divide-y divide-border/60 stagger-up">
            {filtered.map((e) => (
              <AuditRow key={e.eventId} event={e} />
            ))}
          </ul>
          {nextCursor && !search && (
            <div className="border-t border-border bg-muted/30 px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchPage(nextCursor, false)}
                loading={loadingMore}
                className="w-full"
              >
                Load older events
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false)
  const domain = event.action.split('.')[0] || 'other'
  const hasDetail = !!event.before || !!event.after || !!event.metadata

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-start gap-3 px-5 py-3 text-left transition-colors',
          hasDetail ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <UserCog className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {event.actorEmail || event.actorId}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {domain}
            </Badge>
            <code
              className="text-[10px] font-mono text-muted-foreground"
              title={event.action}
            >
              {labelForAction(event.action)}
            </code>
          </div>
          <p className="mt-0.5 text-sm text-foreground/85">{event.summary}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTimestamp(event.createdAt)}
          </p>
        </div>
      </button>
      {expanded && hasDetail && (
        <div className="border-t border-border/60 bg-muted/20 px-5 py-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {event.before != null && (
              <DetailBlock title="Before" value={event.before} />
            )}
            {event.after != null && (
              <DetailBlock title="After" value={event.after} />
            )}
          </div>
          {event.metadata != null && (
            <div className="mt-3">
              <DetailBlock title="Metadata" value={event.metadata} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function DetailBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg bg-card p-2 text-[11px] font-mono text-foreground/80 border border-border/60">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
