'use client'

import { Lock } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface FeaturesPanelProps {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}

/** snake_case feature key as stored on the backend → camelCase as
 *  the API client returns it. Kept tiny — only the keys the panel
 *  needs to map back when checking against `plan.featuresAllowed`
 *  (the plan ships snake_case, the settings dict ships camelCase). */
const CAMEL_TO_SNAKE: Record<string, string> = {
  activityMonitoring: 'activity_monitoring',
  screenshots: 'screenshots',
  aiSummaries: 'ai_summaries',
  dayOffs: 'day_offs',
  taskUpdates: 'task_updates',
  comments: 'comments',
  birthdayWishes: 'birthday_wishes',
  notifications: 'notifications',
  attendance: 'attendance',
  reports: 'reports',
  desktopApp: 'desktop_app',
  customPipelines: 'custom_pipelines',
  customRoles: 'custom_roles',
  apiAccess: 'api_access',
  sso: 'sso',
  auditLogs: 'audit_logs',
  whiteLabel: 'white_label',
  customDomain: 'custom_domain',
}

/**
 * Curated metadata for known feature flags. Keyed by the *camelCase*
 * id we receive from the API (the client transforms `snake_case` →
 * `camelCase` on response in lib/api/client.ts).
 *
 * Anything missing from this map still renders — `humanize()` builds a
 * label from the key by splitting on the camelCase boundary. Internal
 * flags (`onboardingChecklistDismissed`, etc.) are filtered out by
 * `INTERNAL_FLAGS` below so they never reach the UI.
 */
const FEATURE_META: Record<
  string,
  { label: string; description: string; group: 'productivity' | 'monitoring' | 'communication' | 'identity' }
> = {
  // Monitoring
  activityMonitoring: {
    label: 'Activity monitoring',
    description:
      'Track keyboard + mouse activity during a timer session. Powers the per-user activity report.',
    group: 'monitoring',
  },
  screenshots: {
    label: 'Screenshots',
    description:
      'Periodic desktop captures while a timer is running. Stored encrypted; only admins can view.',
    group: 'monitoring',
  },
  aiSummaries: {
    label: 'AI work summaries',
    description:
      'Generate a narrative of each member\'s day from their activity bucket — themes, focus, concerns.',
    group: 'monitoring',
  },

  // Productivity
  dayOffs: {
    label: 'Day-off requests',
    description: 'Members request leave through the dashboard; admins approve or reject.',
    group: 'productivity',
  },
  taskUpdates: {
    label: 'Daily updates',
    description: 'End-of-day work summaries — what each member shipped, blockers, plans for tomorrow.',
    group: 'productivity',
  },

  // Communication
  comments: {
    label: 'Task comments',
    description: 'Threaded comments on tasks for context, decisions, and links.',
    group: 'communication',
  },
  birthdayWishes: {
    label: 'Birthday wishes',
    description: 'Highlight a member\'s birthday on the dashboard so the team can send a note.',
    group: 'communication',
  },
  notifications: {
    label: 'Notifications',
    description: 'In-app notification center for events, approvals, and mentions.',
    group: 'communication',
  },

  // Identity (legacy keys some tenants may still have)
  attendance: {
    label: 'Attendance tracking',
    description: 'Sign-in / sign-out timer with monthly attendance reports.',
    group: 'productivity',
  },
  reports: {
    label: 'Time reports',
    description: 'Cross-project hour tracking, charts, and CSV export.',
    group: 'productivity',
  },
  desktopApp: {
    label: 'Desktop app download',
    description: 'Show the desktop companion app card on the dashboard.',
    group: 'identity',
  },
}

/**
 * Internal flags persisted in `OrgSettings.features` for state that
 * isn't a feature toggle (e.g. "the OWNER has dismissed the onboarding
 * checklist"). These would confuse the OWNER if they appeared as
 * toggleable rows here, so we hide them.
 */
const INTERNAL_FLAGS = new Set([
  'onboardingChecklistDismissed',
  'onboardingDesktopInstalled',
  'onboardingBrandingDone',
])

const GROUP_META: Record<
  'productivity' | 'monitoring' | 'communication' | 'identity',
  { label: string; description: string }
> = {
  productivity: {
    label: 'Productivity',
    description: 'Day-to-day workflow tools your team relies on.',
  },
  monitoring: {
    label: 'Monitoring',
    description: 'Activity, screenshots, and AI-generated work summaries.',
  },
  communication: {
    label: 'Communication',
    description: 'How members signal status, share context, and acknowledge each other.',
  },
  identity: {
    label: 'Identity',
    description: 'Workspace-level identity surfaces and integrations.',
  },
}

const GROUP_ORDER: Array<keyof typeof GROUP_META> = [
  'productivity',
  'monitoring',
  'communication',
  'identity',
]

/**
 * Humanise an unknown camelCase / snake_case key into a readable
 * label. Used as a fallback when a flag isn't in `FEATURE_META`.
 *
 * Splits on:
 *   - lowercase → uppercase boundaries (`birthdayWishes` → `birthday Wishes`)
 *   - underscores (`day_offs` → `day offs`)
 *   - acronym boundaries (`aiSummaries` → `ai Summaries`, then capitalised)
 *
 * Then capitalises the first letter and lower-cases the rest, so we
 * always end up with sentence-case prose, not Title Case Of Every Word.
 */
function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
}

export function FeaturesPanel({ value, onChange }: FeaturesPanelProps) {
  const { current } = useTenant()
  const planFeatures = current?.plan?.featuresAllowed
  const planTier = current?.plan?.tier

  /** A feature is plan-locked when the tenant's plan ships an explicit
   *  features list AND the feature isn't in it. The OWNER can see the
   *  row but the toggle is disabled — flipping it server-side would
   *  bounce off `require_feature` anyway. */
  const isPlanLocked = (camelKey: string): boolean => {
    if (!Array.isArray(planFeatures) || planFeatures.length === 0) return false
    const snakeKey = CAMEL_TO_SNAKE[camelKey] ?? camelKey
    return !planFeatures.includes(snakeKey)
  }

  const visibleEntries = Object.entries(value).filter(
    ([key]) => !INTERNAL_FLAGS.has(key),
  )

  if (visibleEntries.length === 0) {
    return (
      <EmptyState
        title="No features available"
        description="Your plan doesn't expose any toggleable features yet."
      />
    )
  }

  // Bucket entries by group; uncatalogued keys land in "More" at the end.
  const byGroup = new Map<
    keyof typeof GROUP_META | 'other',
    Array<[string, boolean]>
  >()
  for (const [key, enabled] of visibleEntries) {
    const meta = FEATURE_META[key]
    const group = meta?.group ?? 'other'
    if (!byGroup.has(group)) byGroup.set(group, [])
    byGroup.get(group)!.push([key, enabled])
  }

  const orderedGroups: Array<keyof typeof GROUP_META | 'other'> = [
    ...GROUP_ORDER.filter((g) => byGroup.has(g)),
    ...(byGroup.has('other') ? (['other'] as const) : []),
  ]

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-prose text-sm text-muted-foreground">
        Turn features on or off for everyone in your workspace. Members will
        see the change on their next page load.
      </p>

      {orderedGroups.map((group) => {
        const entries = byGroup.get(group) ?? []
        const groupMeta =
          group === 'other'
            ? { label: 'More', description: 'Additional flags exposed by your plan.' }
            : GROUP_META[group]
        return (
          <section key={group} className="flex flex-col gap-3">
            <header>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {groupMeta.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
                {groupMeta.description}
              </p>
            </header>
            <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
              {entries.map(([key, enabled]) => {
                const meta = FEATURE_META[key]
                const label = meta?.label ?? humanize(key)
                const description = meta?.description
                const locked = isPlanLocked(key)
                return (
                  <label
                    key={key}
                    className={
                      locked
                        ? 'flex cursor-not-allowed items-start justify-between gap-6 px-5 py-4 opacity-70'
                        : 'flex cursor-pointer items-start justify-between gap-6 px-5 py-4 transition-colors hover:bg-muted/30'
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {label}
                        </p>
                        {locked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" />
                            Pro
                          </span>
                        )}
                      </div>
                      {description && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      )}
                      {locked && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                          {planTier === 'FREE'
                            ? 'Upgrade to Pro to enable this feature.'
                            : 'Not included on your current plan.'}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <Switch
                        checked={enabled && !locked}
                        disabled={locked}
                        onCheckedChange={(v) =>
                          onChange({ ...value, [key]: !!v })
                        }
                      />
                    </div>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
