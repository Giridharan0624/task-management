'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  AlertCircle,
  Briefcase,
  Crown,
  HardDrive,
  KanbanSquare,
  Sparkles,
  Users,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { useUsers } from '@/lib/hooks/useUsers'
import { useProjects } from '@/lib/hooks/useProjects'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { PageHeader } from '@/components/ui/PageHeader'
import { BackToSettings } from '@/components/settings/BackToSettings'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils'

const TIER_META: Record<
  'FREE' | 'PRO' | 'ENTERPRISE',
  { label: string; tagline: string; tint: string; Icon: typeof Crown }
> = {
  FREE: {
    label: 'Free',
    tagline: 'Up to 10 members · 3 projects · 30-day retention',
    tint: 'bg-slate-50 text-slate-700 ring-slate-200',
    Icon: Sparkles,
  },
  PRO: {
    label: 'Pro',
    tagline: 'Up to 50 members · 50 projects · 1 year retention',
    tint: 'bg-violet-50 text-violet-700 ring-violet-200',
    Icon: Briefcase,
  },
  ENTERPRISE: {
    label: 'Enterprise',
    tagline: 'Unlimited seats · unlimited projects · custom retention',
    tint: 'bg-amber-50 text-amber-700 ring-amber-200',
    Icon: Crown,
  },
}

export default function PlanSettingsPage() {
  const { user } = useAuth()
  const { current } = useTenant()
  const router = useRouter()

  const { data: users } = useUsers()
  const { data: projects } = useProjects()

  // Authz — plan is OWNER-only (matches settings.edit gate on backend).
  useEffect(() => {
    if (user && user.systemRole !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [user, router])

  const plan = current?.plan
  const tier = plan?.tier ?? 'FREE'
  const meta = TIER_META[tier]

  const userCount = users?.length ?? 0
  const projectCount = projects?.length ?? 0

  const rows = useMemo(
    () => [
      {
        label: 'Members',
        icon: Users,
        used: userCount,
        limit: plan?.maxUsers ?? null,
      },
      {
        label: 'Projects',
        icon: KanbanSquare,
        used: projectCount,
        limit: plan?.maxProjects ?? null,
      },
      {
        label: 'Activity retention',
        icon: HardDrive,
        used: null, // no "used" number for retention — just show the limit
        limit: plan?.retentionDays ?? null,
        unit: 'days',
      },
    ],
    [userCount, projectCount, plan],
  )

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-24 animate-fade-in">
      <BackToSettings />
      <PageHeader
        title="Plan & usage"
        description="Your current plan, limits, and how much of each you're using."
      />

      {/* Plan hero card */}
      <Card
        className={cn(
          'flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between',
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl ring-1',
              meta.tint,
            )}
          >
            <meta.Icon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {meta.label}
              </h2>
              <Badge variant="outline" className="text-[10px]">
                Current
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.tagline}
            </p>
          </div>
        </div>
        {tier !== 'ENTERPRISE' && (
          <div className="flex flex-col items-end gap-1">
            <p className="text-[11px] text-muted-foreground">
              Billing isn&apos;t wired up yet. To change plans, contact
              support.
            </p>
          </div>
        )}
      </Card>

      {/* Usage grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 stagger-rise">
        {rows.map((row) => (
          <UsageCard key={row.label} {...row} />
        ))}
      </div>

      {/* Feature allowlist */}
      {plan?.featuresAllowed && plan.featuresAllowed.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Features included in {meta.label}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Each can still be toggled off per-workspace in Features.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.featuresAllowed.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
              >
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </Card>
      )}

      {!plan && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Plan data not loaded yet. Refresh the page.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function UsageCard({
  label,
  icon: Icon,
  used,
  limit,
  unit,
}: {
  label: string
  icon: typeof Users
  used: number | null
  limit: number | null
  unit?: string
}) {
  const unlimited = limit === null || limit === undefined
  const pct = unlimited || used === null ? 0 : Math.min(100, (used / limit) * 100)
  const isNearCap = !unlimited && used !== null && used / (limit ?? 1) >= 0.8
  const isAtCap = !unlimited && used !== null && used >= (limit ?? 0)

  return (
    <Card className="flex flex-col gap-3 p-5 hover-lift-sm">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg icon-pop',
            isAtCap
              ? 'bg-destructive/10 text-destructive'
              : isNearCap
                ? 'bg-amber-100 text-amber-700'
                : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      </div>

      {used === null ? (
        // Retention row — no "used" counter, just the limit value
        <p className="text-2xl font-bold tabular-nums text-foreground leading-none">
          {unlimited ? 'Unlimited' : `${limit} ${unit ?? ''}`}
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold tabular-nums text-foreground leading-none">
              <AnimatedNumber value={used} />
            </p>
            <p className="text-[11px] text-muted-foreground">
              {unlimited ? 'of Unlimited' : `of ${limit}`}
            </p>
          </div>
          {!unlimited && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isAtCap
                    ? 'bg-destructive'
                    : isNearCap
                      ? 'bg-amber-500'
                      : 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {isAtCap && (
            <p className="text-[11px] font-semibold text-destructive">
              Limit reached
            </p>
          )}
          {isNearCap && !isAtCap && (
            <p className="text-[11px] font-semibold text-amber-700">
              Approaching limit
            </p>
          )}
        </>
      )}
    </Card>
  )
}
