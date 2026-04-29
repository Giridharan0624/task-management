'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ShieldCheck,
  Sliders,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import {
  setOrgFeatures,
  suspendOrg,
  unsuspendOrg,
} from '@/lib/api/platformApi'
import type { OrgSummary } from '@/types/org'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

/**
 * Platform-operator console.
 *
 * Access: gated by `NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS` — a
 * comma-separated list of Cognito sub values. Must be kept in sync
 * with the backend's `PLATFORM_ADMIN_USER_IDS` env. Users not in
 * the list see a 404-ish empty render. The backend is the real
 * authority — this gate is UX, not security.
 *
 * Surfaces:
 *   1. Lookup: admin types a workspace slug; we resolve it via the
 *      existing public `GET /orgs/by-slug/{slug}` endpoint to get
 *      the orgId + basic metadata. No global "list all tenants"
 *      endpoint exists — deliberately, to keep the footprint small.
 *   2. Suspend / unsuspend the resolved tenant.
 *   3. Toggle feature flags on the resolved tenant. Toggles are
 *      blind — we don't fetch current state (no per-tenant settings
 *      API exposed to non-tenant callers). Flipping "on" is
 *      idempotent.
 */

const WELL_KNOWN_FEATURES: {
  key: string
  label: string
  description: string
}[] = [
  {
    key: 'birthday_wishes',
    label: 'Birthday wishes',
    description: 'Automated birthday banners + /birthdays page.',
  },
  {
    key: 'activity_monitoring',
    label: 'Activity monitoring',
    description: 'Keyboard/mouse counts + screenshots from desktop.',
  },
  {
    key: 'screenshots',
    label: 'Screenshots',
    description: 'Desktop screenshot capture (requires plan tier).',
  },
  {
    key: 'ai_summaries',
    label: 'AI summaries',
    description: 'Nightly Groq-generated productivity summaries.',
  },
  {
    key: 'day_offs',
    label: 'Day-offs',
    description: 'Leave request/approve workflow.',
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'Task comments.',
  },
  {
    key: 'task_updates',
    label: 'Task updates',
    description: 'Daily task-update posts + weekly rollup.',
  },
]

function getPlatformAdminIds(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export default function PlatformAdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const allowedIds = useMemo(getPlatformAdminIds, [])
  const isAllowed = user ? allowedIds.has(user.userId) : false

  const [slug, setSlug] = useState('')
  const [target, setTarget] = useState<OrgSummary | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const [pendingFeatureKey, setPendingFeatureKey] = useState<string | null>(
    null,
  )
  const [suspending, setSuspending] = useState(false)

  // Redirect non-allowed users. Deliberately delayed — waiting for
  // `user` to hydrate so we don't kick out an allowed admin on the
  // first render pass.
  useEffect(() => {
    if (!user) return
    if (!isAllowed) {
      router.replace('/dashboard')
    }
  }, [user, isAllowed, router])

  const onLookup = useCallback(async () => {
    setLookupError(null)
    setLookingUp(true)
    setTarget(null)
    try {
      const normalized = slug.trim().toLowerCase()
      if (!normalized) {
        setLookupError('Enter a workspace slug.')
        return
      }
      const resolved = await orgsApi.getBySlug(normalized)
      setTarget(resolved)
    } catch (e) {
      setLookupError(
        e instanceof Error
          ? e.message
          : 'Could not resolve slug. Typo or deleted tenant?',
      )
    } finally {
      setLookingUp(false)
    }
  }, [slug])

  const onSuspend = async () => {
    if (!target) return
    const ok = await confirm({
      title: `Suspend ${target.name}?`,
      description:
        'All writes by tenant users will be blocked. Reads continue. They will see a prominent banner.',
      confirmLabel: 'Suspend workspace',
      variant: 'danger',
    })
    if (!ok) return
    setSuspending(true)
    try {
      const res = await suspendOrg(target.orgId)
      toast.success('Workspace suspended.')
      setTarget({ ...target, status: res.org.status as OrgSummary['status'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suspend failed.')
    } finally {
      setSuspending(false)
    }
  }

  const onUnsuspend = async () => {
    if (!target) return
    setSuspending(true)
    try {
      const res = await unsuspendOrg(target.orgId)
      toast.success('Workspace resumed.')
      setTarget({ ...target, status: res.org.status as OrgSummary['status'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unsuspend failed.')
    } finally {
      setSuspending(false)
    }
  }

  const onToggleFeature = async (key: string, enable: boolean) => {
    if (!target) return
    setPendingFeatureKey(key)
    try {
      await setOrgFeatures(target.orgId, { [key]: enable })
      toast.success(
        `${enable ? 'Enabled' : 'Disabled'} "${key}" for ${target.slug}.`,
      )
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Feature toggle failed.',
      )
    } finally {
      setPendingFeatureKey(null)
    }
  }

  if (!user || !isAllowed) {
    return null
  }

  const isSuspended = target?.status === 'SUSPENDED'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Platform console"
        description="Operator-only controls for managing any tenant workspace."
      />

      <Card className="p-4">
        <div className="flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">
              You&apos;re a platform admin.
            </p>
            <p className="mt-0.5">
              Actions taken here affect OTHER tenants, not your own.
              Every change is audited under the target tenant&apos;s
              timeline.
            </p>
          </div>
        </div>
      </Card>

      {/* Lookup */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Look up tenant
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the workspace slug (the value after{' '}
            <code className="rounded bg-muted/60 px-1">SLUG#</code> in
            the DynamoDB resolver).
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onLookup()
            }}
          />
          <Button onClick={onLookup} loading={lookingUp} disabled={!slug.trim()}>
            Look up
          </Button>
        </div>
        {lookupError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{lookupError}</AlertDescription>
          </Alert>
        )}
      </Card>

      {target && (
        <>
          {/* Target summary */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Resolved tenant
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-foreground">
                  {target.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  <code className="rounded bg-muted/60 px-1 font-mono">
                    {target.orgId}
                  </code>{' '}
                  · slug <code className="rounded bg-muted/60 px-1 font-mono">{target.slug}</code>
                </p>
              </div>
              <Badge
                tone={isSuspended ? 'danger' : 'success'}
                size="md"
              >
                {target.status}
              </Badge>
            </div>
          </Card>

          {/* Suspension controls */}
          <Card className="space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Ban className="h-4 w-4" />
              Suspension
            </h3>
            <p className="text-xs text-muted-foreground">
              Suspended tenants are read-only. Users see a banner;
              every mutation handler returns{' '}
              <code className="rounded bg-muted/60 px-1 font-mono">
                ORG_SUSPENDED
              </code>
              . Reversible anytime.
            </p>
            {isSuspended ? (
              <Button onClick={onUnsuspend} loading={suspending}>
                <CheckCircle2 className="h-4 w-4" />
                Unsuspend workspace
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={onSuspend}
                loading={suspending}
              >
                <Ban className="h-4 w-4" />
                Suspend workspace
              </Button>
            )}
          </Card>

          {/* Feature toggles */}
          <Card className="space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Sliders className="h-4 w-4" />
              Feature flags
            </h3>
            <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Toggles below send a targeted <code>PATCH</code> — we
                don&apos;t read the tenant&apos;s current state. Flipping{' '}
                &quot;on&quot; is idempotent; flipping &quot;off&quot;
                disables regardless of prior value.
              </AlertDescription>
            </Alert>

            <div className="divide-y divide-border rounded-lg border border-border">
              {WELL_KNOWN_FEATURES.map((f) => (
                <div
                  key={f.key}
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {f.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.description} ·{' '}
                      <code className="rounded bg-muted/60 px-1 font-mono">
                        {f.key}
                      </code>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onToggleFeature(f.key, true)}
                      loading={pendingFeatureKey === f.key}
                    >
                      Enable
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onToggleFeature(f.key, false)}
                      loading={pendingFeatureKey === f.key}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Disable
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
