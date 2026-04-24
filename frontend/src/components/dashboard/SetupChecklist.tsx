'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  UserPlus,
  FolderPlus,
  Download,
  Palette,
  X,
  ArrowRight,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { useUsers } from '@/lib/hooks/useUsers'
import { useProjects } from '@/lib/hooks/useProjects'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import { cn } from '@/lib/utils'

// Server-persisted flag keys inside OrgSettings.features. The dashboard
// previously stored these in localStorage, which made dismissals and
// "marked done" ticks per-browser. They live on the org now so the OWNER
// sees the same state across devices and after clearing site data.
const FLAG_DISMISSED = 'onboarding_checklist_dismissed'
const FLAG_DESKTOP = 'onboarding_desktop_installed'
const FLAG_BRANDING = 'onboarding_branding_done'

// Brand defaults we ship with — MUST match the backend OrgSettings seed
// (`primary_color = "#4F46E5"`, `accent_color = "#10B981"` in
// backend/src/contexts/org/domain/entities.py). Used as a courtesy
// auto-tick for owners who customised before the explicit flag existed.
const DEFAULT_PRIMARY = '#4f46e5'
const DEFAULT_ACCENT = '#10b981'

interface Step {
  key: string
  title: string
  description: string
  done: boolean
  icon: React.ComponentType<{ className?: string }>
  action: React.ReactNode
}

/**
 * First-run onboarding for a new workspace. Four concrete steps an OWNER
 * should do before the app feels "set up": invite teammates, create a
 * project, install the desktop companion, and customize branding.
 *
 * Hides itself when all four are done OR when the user dismisses it.
 * State is read from `current.settings.features` (server-persisted) so
 * the UI stays consistent across browsers and devices.
 */
export function SetupChecklist() {
  const { data: users } = useUsers()
  const { data: projects } = useProjects()
  const { current, refreshCurrent } = useTenant()

  const settings = current?.settings
  const features = settings?.features ?? {}

  const dismissed = features[FLAG_DISMISSED] === true
  const desktopMarkedDone = features[FLAG_DESKTOP] === true
  const brandingMarkedDone = features[FLAG_BRANDING] === true

  // Pending state per-flag so a slow network doesn't lock the whole card.
  const [pending, setPending] = useState<string | null>(null)

  // Avoid hydration mismatch — `current` is hydrated client-side after
  // login, so first server render has nothing to gate on.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const setFlag = async (key: string, value: boolean) => {
    if (!features) return
    setPending(key)
    try {
      // Replace the whole features dict — the PUT handler swaps the
      // field wholesale, so any partial payload would drop the other
      // toggles (birthday_wishes, ai_summaries, ...).
      await orgsApi.updateSettings({ features: { ...features, [key]: value } })
      await refreshCurrent()
    } catch {
      // Swallow — the user can retry; we deliberately don't toast here
      // because the checklist itself is non-critical UI.
    } finally {
      setPending(null)
    }
  }

  const nonOwnerUsers = (users ?? []).filter((u) => u.systemRole !== 'OWNER')
  const hasTeammates = nonOwnerUsers.length > 0
  const hasProject = (projects ?? []).length > 0
  // Branding step ticks when EITHER the owner explicitly marked it OR
  // they have saved a colour that differs from the seeded defaults. The
  // explicit flag is the primary source of truth; the colour heuristic
  // covers tenants that customised before the flag existed.
  const colorsCustomised =
    !!settings &&
    (settings.primaryColor?.toLowerCase() !== DEFAULT_PRIMARY ||
      settings.accentColor?.toLowerCase() !== DEFAULT_ACCENT)
  const hasBranding = brandingMarkedDone || colorsCustomised

  const steps: Step[] = [
    {
      key: 'invite',
      title: 'Invite your team',
      description: 'Bring the people who will use this workspace.',
      done: hasTeammates,
      icon: UserPlus,
      action: (
        <Button asChild variant="primary" size="sm">
          <Link href="/admin/users">
            Invite teammates
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
    {
      key: 'project',
      title: 'Create your first project',
      description: 'Projects are where tasks, members, and reports live.',
      done: hasProject,
      icon: FolderPlus,
      action: (
        <Button asChild variant="primary" size="sm">
          <Link href="/projects">
            Create project
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
    {
      key: 'desktop',
      title: 'Install the desktop app',
      description:
        'Runs your timer, tracks activity, and captures daily summaries.',
      done: desktopMarkedDone,
      icon: Download,
      action: (
        <Button
          variant="secondary"
          size="sm"
          loading={pending === FLAG_DESKTOP}
          onClick={() => setFlag(FLAG_DESKTOP, true)}
        >
          I installed it
        </Button>
      ),
    },
    {
      key: 'branding',
      title: 'Customize your workspace',
      description: 'Pick colors that match your brand.',
      done: hasBranding,
      icon: Palette,
      action: (
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            loading={pending === FLAG_BRANDING}
            onClick={() => setFlag(FLAG_BRANDING, true)}
          >
            Mark done
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/settings/organization">
              Open settings
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const total = steps.length
  const percent = Math.round((completed / total) * 100)

  // Gate visibility — hooks must run in the same order every render, so
  // these checks live below all the useState/useEffect calls.
  if (!mounted) return null
  if (!settings) return null
  if (dismissed) return null
  if (completed === total) return null

  return (
    <Card className="overflow-hidden p-0 animate-fade-in">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/8 to-accent/5 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Get started
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Finish setting up your workspace
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {completed} of {total} complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFlag(FLAG_DISMISSED, true)}
          disabled={pending === FLAG_DISMISSED}
          aria-label="Dismiss setup checklist"
          className="-m-1 rounded-lg p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 pt-3">
        <Progress value={percent} className="h-1.5" />
      </div>

      <ul className="divide-y divide-border/60 px-2 py-2">
        {steps.map((step) => (
          <ChecklistItem key={step.key} step={step} />
        ))}
      </ul>
    </Card>
  )
}

function ChecklistItem({ step }: { step: Step }) {
  const { done, title, description, icon: Icon, action } = step
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <div
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
          done
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted/60 text-muted-foreground'
        )}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'flex items-center gap-2 text-[13px] font-semibold',
            done
              ? 'text-muted-foreground line-through decoration-muted-foreground/40'
              : 'text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {title}
        </p>
        {!done && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {!done && <div className="shrink-0">{action}</div>}
    </li>
  )
}
