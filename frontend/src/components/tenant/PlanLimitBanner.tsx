'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { useTenant } from '@/lib/tenant/TenantProvider'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useUsers } from '@/lib/hooks/useUsers'
import { useProjects } from '@/lib/hooks/useProjects'
import { cn } from '@/lib/utils'

type LimitKind = 'seats' | 'projects'

interface Props {
  /** Which limits to watch. Defaults to all. */
  kinds?: LimitKind[]
  /** Hide the banner even when at/over limit (pages that already surface
   *  the same information inline — e.g. /settings/plan). */
  hidden?: boolean
}

/**
 * Plan-limit awareness banner. Surfaces when a tenant is approaching
 * (>=80%) or has reached any of its plan limits. Placed near the top
 * of the dashboard / members / projects pages so admins notice before
 * they run into a hard refusal from the backend.
 *
 * Only renders for OWNERs — members/admins can't change the plan.
 */
export function PlanLimitBanner({ kinds, hidden = false }: Props) {
  const { user } = useAuth()
  const { current } = useTenant()
  const { data: users } = useUsers()
  const { data: projects } = useProjects()

  if (hidden) return null
  if (user?.systemRole !== 'OWNER') return null
  const plan = current?.plan
  if (!plan) return null

  const watch = kinds ?? ['seats', 'projects']
  const warnings: { kind: LimitKind; used: number; limit: number; atCap: boolean }[] = []

  if (watch.includes('seats') && plan.maxUsers != null) {
    const used = users?.length ?? 0
    if (used / plan.maxUsers >= 0.8) {
      warnings.push({
        kind: 'seats',
        used,
        limit: plan.maxUsers,
        atCap: used >= plan.maxUsers,
      })
    }
  }
  if (watch.includes('projects') && plan.maxProjects != null) {
    const used = projects?.length ?? 0
    if (used / plan.maxProjects >= 0.8) {
      warnings.push({
        kind: 'projects',
        used,
        limit: plan.maxProjects,
        atCap: used >= plan.maxProjects,
      })
    }
  }

  if (warnings.length === 0) return null

  const anyAtCap = warnings.some((w) => w.atCap)
  const label = (k: LimitKind) => (k === 'seats' ? 'members' : 'projects')

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        anyAtCap
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-amber-300 bg-amber-50 text-amber-800',
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {anyAtCap ? 'Plan limit reached' : 'Approaching plan limit'}
          </p>
          <p className="text-xs mt-0.5">
            {warnings
              .map(
                (w) =>
                  `${w.used} of ${w.limit} ${label(w.kind)}${
                    w.atCap ? ' (full)' : ''
                  }`,
              )
              .join(' · ')}
          </p>
        </div>
      </div>
      <Link
        href="/settings/plan"
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
          anyAtCap
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-amber-600 text-white hover:bg-amber-700',
        )}
      >
        Manage plan
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
