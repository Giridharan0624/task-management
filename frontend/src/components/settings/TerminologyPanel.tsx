'use client'

import { useMemo, useState } from 'react'
import { Search, X, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { BASE_TERMINOLOGY } from '@/lib/tenant/i18n'
import { cn } from '@/lib/utils'

interface TerminologyPanelProps {
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

/**
 * Friendly label derived from a key like `task.singular` →
 * "Task (singular)". Falls back to the raw key if the format is unknown.
 */
function labelForKey(key: string): { label: string; sub?: string } {
  const [domain, sub] = key.split('.')
  const cap = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
  if (!sub) return { label: cap(domain) }
  return { label: cap(domain), sub: cap(sub) }
}

/**
 * Group label for a domain prefix. New domains fall back to a humanized
 * version of the prefix automatically.
 */
const DOMAIN_LABELS: Record<string, string> = {
  task: 'Tasks',
  project: 'Projects',
  user: 'Users & Team',
  attendance: 'Attendance & Timer',
  dayoff: 'Day-offs',
  nav: 'Navigation',
}

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1)
}

export function TerminologyPanel({ value, onChange }: TerminologyPanelProps) {
  const [search, setSearch] = useState('')

  // Group base keys by domain prefix; preserve definition order within each domain
  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; defaultValue: string }[]>()
    for (const [key, defaultValue] of Object.entries(BASE_TERMINOLOGY)) {
      const domain = key.split('.')[0]
      if (!groups.has(domain)) groups.set(domain, [])
      groups.get(domain)!.push({ key, defaultValue })
    }
    return Array.from(groups.entries())
  }, [])

  const q = search.trim().toLowerCase()
  const overriddenCount = Object.keys(value).filter(
    (k) => value[k]?.trim() && value[k] !== BASE_TERMINOLOGY[k]
  ).length

  const updateOne = (key: string, next: string) => {
    const map = { ...value }
    if (!next.trim()) delete map[key]
    else map[key] = next
    onChange(map)
  }

  const resetAll = () => onChange({})

  // Filter rows by search
  const visibleGroups = grouped
    .map(([domain, rows]) => {
      if (!q) return [domain, rows] as const
      const filtered = rows.filter(({ key, defaultValue }) => {
        const v = value[key] ?? ''
        return (
          key.toLowerCase().includes(q) ||
          defaultValue.toLowerCase().includes(q) ||
          v.toLowerCase().includes(q) ||
          domain.toLowerCase().includes(q)
        )
      })
      return [domain, filtered] as const
    })
    .filter(([, rows]) => rows.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Override how TaskFlow refers to things in your workspace. Leave a
          field blank to use the default.
        </p>
        {overriddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all ({overriddenCount} custom)
          </Button>
        )}
      </div>

      <div className="max-w-sm">
        <Input
          type="text"
          placeholder="Search terms..."
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

      {visibleGroups.length === 0 ? (
        <EmptyState
          title="No matching terms"
          description={`Nothing matches "${search}".`}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map(([domain, rows]) => (
            <Card key={domain} className="overflow-hidden p-0">
              <div className="border-b border-border bg-muted/30 px-5 py-3">
                <h3 className="text-sm font-bold text-foreground">
                  {domainLabel(domain)}
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-3 p-5 md:grid-cols-2">
                {rows.map(({ key, defaultValue }) => {
                  const meta = labelForKey(key)
                  const current = value[key] ?? ''
                  const isOverridden = !!current && current !== defaultValue
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                          {meta.sub ? `${meta.label} (${meta.sub})` : meta.label}
                        </label>
                        {isOverridden && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            Custom
                          </span>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={current}
                        onChange={(e) => updateOne(key, e.target.value)}
                        placeholder={defaultValue}
                        className={cn(
                          'h-9',
                          isOverridden && 'border-primary/40 bg-primary/5'
                        )}
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Default: <span className="font-medium">{defaultValue}</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
