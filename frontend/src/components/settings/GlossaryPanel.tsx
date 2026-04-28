'use client'

import { useState } from 'react'
import { ChevronDown, RotateCcw, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BASE_TERMINOLOGY } from '@/lib/tenant/i18n'
import { cn } from '@/lib/utils'
import { TerminologyPanel } from './TerminologyPanel'

interface GlossaryPanelProps {
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

/**
 * English-pluralisation heuristic. Handles the three regular patterns
 * that cover almost every workspace noun ("Task" → "Tasks", "Box" →
 * "Boxes", "City" → "Cities"). Preserves the casing of the trailing
 * letter so "TASK" pluralises to "TASKS" and "task" to "tasks".
 *
 * Skipped on purpose: irregular English plurals (mouse / mice, person
 * / people) — the user always retains the option to override the
 * generated plural by hand.
 */
function pluralize(input: string): string {
  const stem = input.trim()
  if (!stem) return ''

  const lastChar = stem.slice(-1)
  const upper =
    lastChar === lastChar.toUpperCase() && lastChar !== lastChar.toLowerCase()
  const lower = stem.toLowerCase()

  // Sibilant endings get "es": bus, box, buzz, church, dish.
  if (/(s|x|z|ch|sh)$/.test(lower)) {
    return stem + (upper ? 'ES' : 'es')
  }
  // Consonant + y → "ies": city → cities. (Vowel + y stays "ys": key → keys.)
  if (/[^aeiou]y$/.test(lower)) {
    return stem.slice(0, -1) + (upper ? 'IES' : 'ies')
  }
  return stem + (upper ? 'S' : 's')
}

/** A glossary noun is the user-facing concept ("Tasks", "Projects").
 *  Editing the singular/plural propagates to every derived UI string —
 *  saves admins from hand-editing 6 separate keys to rename one noun. */
interface Noun {
  id: string
  label: string
  description: string
  /** Source-of-truth keys the user types into. */
  singularKey: string
  pluralKey: string
  /** Map of derived terminology keys → how to compute them from the
   *  effective singular/plural. We only auto-overwrite a derived key
   *  when its current value is still equal to the default-derived value
   *  — i.e. the admin hasn't hand-customized it via the advanced view. */
  derive: Record<string, (singular: string, plural: string) => string>
}

const NOUNS: Noun[] = [
  {
    id: 'task',
    label: 'Tasks',
    description: 'Individual items of work assigned to people.',
    singularKey: 'task.singular',
    pluralKey: 'task.plural',
    derive: {
      'task.new': (s) => `New ${s.toLowerCase()}`,
      'task.create': (s) => `Create ${s.toLowerCase()}`,
      'task.my': (_, p) => `My ${p.toLowerCase()}`,
      'nav.my_tasks': (_, p) => `My ${p.toLowerCase()}`,
    },
  },
  {
    id: 'project',
    label: 'Projects',
    description: 'Containers that group related tasks together.',
    singularKey: 'project.singular',
    pluralKey: 'project.plural',
    derive: {
      'project.new': (s) => `New ${s.toLowerCase()}`,
      'project.create': (s) => `Create ${s.toLowerCase()}`,
      'nav.projects': (_, p) => p,
    },
  },
  {
    id: 'user',
    label: 'Members',
    description: 'People who belong to your workspace.',
    singularKey: 'user.singular',
    pluralKey: 'user.plural',
    derive: {
      'user.team': (_, p) => p,
      'nav.team': (_, p) => p,
    },
  },
  {
    id: 'dayoff',
    label: 'Days off',
    description: 'Time-off requests — leave, sick days, vacation.',
    singularKey: 'dayoff.singular',
    pluralKey: 'dayoff.plural',
    derive: {
      'dayoff.request': (s) => `Request ${s.toLowerCase()}`,
    },
  },
]

export function GlossaryPanel({ value, onChange }: GlossaryPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const customCount = NOUNS.reduce((acc, n) => {
    const sCustom = !!value[n.singularKey]?.trim()
    const pCustom = !!value[n.pluralKey]?.trim()
    return acc + (sCustom || pCustom ? 1 : 0)
  }, 0)

  const resetAll = () => {
    const next = { ...value }
    for (const n of NOUNS) {
      delete next[n.singularKey]
      delete next[n.pluralKey]
      for (const k of Object.keys(n.derive)) delete next[k]
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Rename common terms across your workspace. Edits ripple to every
          related label automatically.
        </p>
        {customCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all glossary terms
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {NOUNS.map((noun) => (
          <NounCard
            key={noun.id}
            noun={noun}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>

      {/* Advanced — full key-by-key editor for power users */}
      <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-card">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
          aria-expanded={showAdvanced}
        >
          <div className="flex items-center gap-3">
            <Settings2
              className="h-3.5 w-3.5 text-muted-foreground"
              strokeWidth={1.8}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Advanced — edit every UI string
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Tweak nav labels, button text, individual keys.
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              showAdvanced && 'rotate-180',
            )}
            strokeWidth={1.8}
          />
        </button>
        {showAdvanced && (
          <div className="border-t border-border/60 bg-muted/20 p-4">
            <TerminologyPanel value={value} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}

function NounCard({
  noun,
  value,
  onChange,
}: {
  noun: Noun
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const baseSingular = BASE_TERMINOLOGY[noun.singularKey] ?? ''
  const basePlural = BASE_TERMINOLOGY[noun.pluralKey] ?? ''

  const singular = value[noun.singularKey] ?? ''
  const plural = value[noun.pluralKey] ?? ''
  const isCustom = !!singular.trim() || !!plural.trim()

  // Effective values used for preview + derivation
  const effSingular = singular.trim() || baseSingular
  const effPlural = plural.trim() || basePlural

  const update = (
    nextSingular: string,
    nextPlural: string,
    /** Which input the user actually edited. When `singular`, we may
     *  auto-pluralise the plural field below. When `plural`, the user
     *  is overriding the generated value — never overwrite it. */
    source: 'singular' | 'plural' = 'plural',
  ) => {
    const next = { ...value }

    // Auto-pluralise: if the user is typing in the singular field AND
    // the plural is either empty or still equal to what we'd derive
    // from the previous singular, derive a fresh plural. Never touch
    // a hand-typed plural.
    if (source === 'singular') {
      const previousAuto = pluralize(singular || baseSingular)
      const pluralIsAuto =
        !plural.trim() || plural === previousAuto || plural === basePlural
      if (pluralIsAuto) {
        nextPlural = nextSingular.trim() ? pluralize(nextSingular) : ''
      }
    }

    // Source keys
    if (nextSingular.trim()) next[noun.singularKey] = nextSingular
    else delete next[noun.singularKey]
    if (nextPlural.trim()) next[noun.pluralKey] = nextPlural
    else delete next[noun.pluralKey]

    // Derived keys — only overwrite if the existing override is still
    // equal to the default-derived form (i.e. the admin hasn't hand-
    // edited it via the advanced view). Respects manual customizations.
    const newEffS = nextSingular.trim() || baseSingular
    const newEffP = nextPlural.trim() || basePlural

    for (const [key, fn] of Object.entries(noun.derive)) {
      const newValue = fn(newEffS, newEffP)
      const baseValue = BASE_TERMINOLOGY[key] ?? ''
      const previousDerivedFromDefaults = fn(baseSingular, basePlural)
      const previousDerivedFromOldEffective = fn(
        singular.trim() || baseSingular,
        plural.trim() || basePlural,
      )
      const currentValue = value[key]

      // Treat as "still default-equivalent" when:
      // - no override stored, OR
      // - the stored value matches the original-default derivation, OR
      // - the stored value matches what we'd derive from the previous
      //   effective singular/plural (the most recent glossary write).
      const isStillDerived =
        currentValue === undefined ||
        currentValue === baseValue ||
        currentValue === previousDerivedFromDefaults ||
        currentValue === previousDerivedFromOldEffective

      if (!isStillDerived) continue

      if (newValue === baseValue) {
        delete next[key]
      } else {
        next[key] = newValue
      }
    }

    onChange(next)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-card p-5 transition-colors',
        isCustom
          ? 'border-foreground/30 shadow-[inset_0_2px_0_0_rgb(var(--color-primary))]'
          : 'border-border/70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{noun.label}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {noun.description}
          </p>
        </div>
        {isCustom && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Custom
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Singular"
          type="text"
          value={singular}
          onChange={(e) => update(e.target.value, plural, 'singular')}
          placeholder={baseSingular}
        />
        <Input
          label="Plural"
          type="text"
          value={plural}
          onChange={(e) => update(singular, e.target.value, 'plural')}
          placeholder={basePlural}
        />
      </div>

      {/* Live preview — shows two derived strings so admins see the ripple */}
      <div className="border-t border-border/60 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Preview
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/85">
          {Object.entries(noun.derive)
            .slice(0, 2)
            .map(([key, fn]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-foreground/40" />
                {fn(effSingular, effPlural)}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}
