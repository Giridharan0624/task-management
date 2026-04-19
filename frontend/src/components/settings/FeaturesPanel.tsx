'use client'

import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'

interface FeaturesPanelProps {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}

/**
 * Curated metadata for known feature flags. Anything not listed here
 * still renders, just without a description (humanized key only).
 */
const FEATURE_META: Record<string, { label: string; description: string }> = {
  attendance: {
    label: 'Attendance tracking',
    description: 'Sign-in / sign-out timer, monthly attendance reports.',
  },
  day_offs: {
    label: 'Day-off requests',
    description: 'Members can request leave; admins approve or reject.',
  },
  task_updates: {
    label: 'Daily updates',
    description: 'Daily end-of-day work summaries from team members.',
  },
  reports: {
    label: 'Time reports',
    description: 'Cross-project hour tracking, charts, and CSV export.',
  },
  birthdays: {
    label: 'Birthday banner',
    description: 'Highlight team birthdays in the dashboard sidebar.',
  },
  desktop_app: {
    label: 'Desktop app download',
    description: 'Show a card linking to the desktop companion app.',
  },
  notifications: {
    label: 'Notifications',
    description: 'In-app notification center for events and approvals.',
  },
}

function humanize(key: string): { label: string; description?: string } {
  if (FEATURE_META[key]) return FEATURE_META[key]
  const label = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return { label }
}

export function FeaturesPanel({ value, onChange }: FeaturesPanelProps) {
  const entries = Object.entries(value)

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No features available"
        description="Your plan doesn't expose any toggleable features yet."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Turn features on or off for everyone in your workspace.
      </p>

      <Card className="divide-y divide-border/60 overflow-hidden p-0">
        {entries.map(([key, enabled]) => {
          const meta = humanize(key)
          return (
            <label
              key={key}
              className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {meta.label}
                </p>
                {meta.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                )}
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => onChange({ ...value, [key]: !!v })}
              />
            </label>
          )
        })}
      </Card>
    </div>
  )
}
