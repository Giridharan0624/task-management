'use client'

/**
 * Internal design-preview sandbox.
 *
 * Not linked from anywhere in the app. Visit `/design-preview` directly
 * to inspect the refined visual patterns proposed by the UI audit before
 * we apply them to the real pages. Each section pairs a "BEFORE" snippet
 * (mirroring what's in production today) with an "AFTER" snippet showing
 * the proposed treatment, so the differences are concrete.
 *
 * Safe to delete the entire `(dashboard)/design-preview/` folder once
 * the production pages are migrated.
 */

import { useState } from 'react'
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Users,
  Sparkles,
  ListTodo,
  CalendarPlus,
  FolderKanban,
  Cake,
  ArrowUpRight,
} from 'lucide-react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────
 * Section primitives
 * ───────────────────────────────────────────────────────────────── */

function Section({
  title,
  description,
  before,
  after,
}: {
  title: string
  description: string
  before: React.ReactNode
  after: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-md text-right text-xs text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Pane label="Before" tone="warn">
          {before}
        </Pane>
        <Pane label="After" tone="ok">
          {after}
        </Pane>
      </div>
    </section>
  )
}

function Pane({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'ok' | 'warn'
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
          tone === 'warn' ? 'text-amber-700' : 'text-emerald-700',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500',
          )}
        />
        {label}
      </span>
      <div className="rounded-lg border border-border/70 bg-background p-4">
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 1 · Stat cards
 * ───────────────────────────────────────────────────────────────── */

function StatCardsBefore() {
  // Mirrors StatCardsGrid + TeamPulseStrip current pattern: gradient
  // background icon-chip + bold uppercase label + lift-on-hover.
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Members', value: 49, color: 'from-indigo-500 to-violet-500', text: 'text-indigo-600' },
        { label: 'Hours', value: '353.5h', color: 'from-blue-500 to-cyan-500', text: 'text-blue-600' },
        { label: 'Projects', value: 6, color: 'from-emerald-500 to-teal-500', text: 'text-emerald-600' },
        { label: 'Overdue', value: 91, color: 'from-rose-500 to-pink-500', text: 'text-rose-600' },
      ].map((m) => (
        <div
          key={m.label}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white',
              m.color,
            )}
          >
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={cn('text-xl font-bold tabular-nums', m.text)}>
              {m.value}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCardsAfter() {
  // Refined: hairline columns inside one card, status dot for tone,
  // no gradients, no icon chips, no hover-lift. Numbers carry weight
  // through size and tabular figures.
  return (
    <Card className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden p-0 shadow-none">
      {[
        { label: 'Members', value: '49', dot: 'bg-slate-400' },
        { label: 'Hours this week', value: '353.5h', dot: 'bg-emerald-500' },
        { label: 'Projects', value: '6', dot: 'bg-slate-400' },
        { label: 'Overdue', value: '91', dot: 'bg-rose-500', tint: 'text-rose-600' },
      ].map((m) => (
        <div key={m.label} className="flex flex-col gap-1.5 p-5">
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {m.label}
            </p>
          </div>
          <p
            className={cn(
              'text-2xl font-medium tabular-nums leading-none',
              m.tint ?? 'text-foreground',
            )}
          >
            {m.value}
          </p>
        </div>
      ))}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 2 · Quick actions
 * ───────────────────────────────────────────────────────────────── */

function QuickActionsBefore() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'New task', icon: Plus, grad: 'from-indigo-500 to-violet-500' },
        { label: 'Day off', icon: CalendarPlus, grad: 'from-emerald-500 to-teal-500' },
        { label: 'Project', icon: FolderKanban, grad: 'from-pink-500 to-rose-500' },
      ].map((a) => (
        <button
          key={a.label}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.05] to-primary/[0.02] p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform group-hover:scale-110',
              a.grad,
            )}
          >
            <a.icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold text-foreground">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

function QuickActionsAfter() {
  // Three flat tiles, hairline border, single underline accent on hover,
  // unified icon weight + size. Action verb stays bold but at body size,
  // no gradient theatre.
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'New task', icon: Plus },
        { label: 'Request day off', icon: CalendarPlus },
        { label: 'New project', icon: FolderKanban },
      ].map((a) => (
        <button
          key={a.label}
          className="group flex items-center justify-between gap-2 rounded-md border border-border/70 bg-card px-4 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5">
            <a.icon
              className="h-3.5 w-3.5 text-muted-foreground"
              strokeWidth={1.8}
            />
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 3 · Hero greeting (TodayHero replacement)
 * ───────────────────────────────────────────────────────────────── */

function HeroBefore() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.05] via-card to-card p-6">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/[0.02] to-accent/[0.04]" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Good morning
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            Welcome back, Aiden
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Tasks', value: '12', color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Hours', value: '5.2h', color: 'bg-emerald-50 text-emerald-700' },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                'flex flex-col items-center rounded-xl px-4 py-2',
                s.color,
              )}
            >
              <span className="text-lg font-bold tabular-nums">{s.value}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HeroAfter() {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border/60 pb-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Monday, 27 April
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Good morning, Aiden
        </h1>
      </div>
      <div className="flex items-baseline gap-6 text-sm">
        <span className="flex flex-col items-end">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tasks today
          </span>
          <span className="text-lg font-medium tabular-nums text-foreground">
            12
          </span>
        </span>
        <span className="h-8 w-px bg-border/60" />
        <span className="flex flex-col items-end">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Hours
          </span>
          <span className="text-lg font-medium tabular-nums text-foreground">
            5.2h
          </span>
        </span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 4 · Project header bar
 * ───────────────────────────────────────────────────────────────── */

function ProjectHeaderBefore() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500" />
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
          <FolderKanban className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-foreground">
            Customer Portal Redesign
          </p>
          <p className="text-xs text-muted-foreground">12 tasks · 4 members</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Task
        </Button>
      </div>
    </div>
  )
}

function ProjectHeaderAfter() {
  return (
    <div className="flex items-center gap-4 border-b border-border/60 pb-4">
      <div className="flex flex-col">
        <span className="h-px w-8 bg-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Project
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-semibold tracking-tight text-foreground">
          Customer Portal Redesign
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          12 tasks · 4 members · Updated 2h ago
        </p>
      </div>
      <Button size="sm" variant="secondary" className="gap-1.5">
        <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        New task
      </Button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 5 · Birthday banner
 * ───────────────────────────────────────────────────────────────── */

function BirthdayBefore() {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-5">
      <div className="absolute right-3 top-3 text-2xl">🎂</div>
      <div className="absolute left-3 top-3 text-xl">🎉</div>
      <div className="absolute bottom-3 right-8 text-xl">🎈</div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-pink-700">
        Today
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        🎉 It&apos;s Aiden&apos;s birthday!
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a wish to brighten their day.
      </p>
      <Button
        size="sm"
        className="mt-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white"
      >
        Send wish
      </Button>
    </div>
  )
}

function BirthdayAfter() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Cake
          className="h-3.5 w-3.5 text-rose-500"
          strokeWidth={1.8}
        />
        <p className="text-sm text-foreground">
          <span className="font-medium">Aiden Coleman</span>
          <span className="text-muted-foreground"> · birthday today</span>
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs font-medium text-foreground hover:bg-muted/60"
      >
        Send wish
        <ArrowUpRight className="h-3 w-3" strokeWidth={1.8} />
      </Button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 6 · Empty state
 * ───────────────────────────────────────────────────────────────── */

function EmptyBefore() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-primary/[0.03] to-accent/[0.03] py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 shadow-sm">
        <ListTodo className="h-6 w-6 text-primary animate-pulse" />
      </div>
      <p className="text-base font-bold text-foreground">No tasks yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Create your first task to get rolling.
      </p>
      <Button size="sm" className="mt-3 gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Create task
      </Button>
    </div>
  )
}

function EmptyAfter() {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border/70 py-12 text-center">
      <ListTodo
        className="h-5 w-5 text-muted-foreground/70"
        strokeWidth={1.4}
      />
      <p className="mt-3 text-sm font-medium text-foreground">
        No tasks yet
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Create your first task to get rolling.
      </p>
      <Button variant="ghost" size="sm" className="mt-3 gap-1.5 text-xs">
        <Plus className="h-3 w-3" strokeWidth={1.8} />
        Create task
      </Button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 7 · Status badge
 * ───────────────────────────────────────────────────────────────── */

function BadgeBefore() {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: 'IN PROGRESS', color: 'bg-blue-100 text-blue-700' },
        { label: 'BLOCKED', color: 'bg-red-100 text-red-700' },
        { label: 'DONE', color: 'bg-emerald-100 text-emerald-700' },
        { label: 'PENDING', color: 'bg-amber-100 text-amber-700' },
      ].map((b) => (
        <span
          key={b.label}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm',
            b.color,
          )}
        >
          ● {b.label}
        </span>
      ))}
    </div>
  )
}

function BadgeAfter() {
  return (
    <div className="flex flex-wrap gap-3">
      {[
        { label: 'In progress', dot: 'bg-blue-500', text: 'text-blue-700' },
        { label: 'Blocked', dot: 'bg-rose-500', text: 'text-rose-700' },
        { label: 'Done', dot: 'bg-emerald-500', text: 'text-emerald-700' },
        { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700' },
      ].map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium"
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', b.dot)} />
          <span className={b.text}>{b.label}</span>
        </span>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * 8 · AI summary block (matches the ActivityReport pattern)
 * ───────────────────────────────────────────────────────────────── */

function AiSummaryBefore() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.04] p-5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm">
        <Sparkles className="h-3 w-3" />
        AI Summary
      </span>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        Aiden had a productive morning, focused on the redesign. Code editor
        dominated, with brief Slack interruptions.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Deep work', 'Code review', 'Slack'].map((t) => (
          <span
            key={t}
            className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            ● {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function AiSummaryAfter() {
  return (
    <div className="relative overflow-hidden bg-card p-5">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: '#6366f1' }}
      />
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <Sparkles
          className="h-3 w-3"
          strokeWidth={1.8}
          style={{ color: '#6366f1' }}
        />
        <p className="text-sm font-medium text-foreground">AI work summary</p>
      </div>
      <p className="mt-3 text-[13px] leading-[1.7] text-foreground/90">
        Aiden had a productive morning, focused on the redesign. Code editor
        dominated, with brief Slack interruptions.
      </p>
      <div className="mt-4 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Themes
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-foreground">
          {[
            { label: 'Deep work', dot: '#6366f1' },
            { label: 'Code review', dot: '#10b981' },
            { label: 'Slack', dot: '#0ea5e9' },
          ].map((t) => (
            <li key={t.label} className="flex items-center gap-2">
              <span
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: t.dot }}
              />
              {t.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * Page composition
 * ───────────────────────────────────────────────────────────────── */

const PRINCIPLES = [
  {
    title: 'Hairlines beat fills',
    body: 'Section structure carried by 1-px borders, not tinted backgrounds. Reserves color for meaning.',
  },
  {
    title: 'Status as dot',
    body: 'A 1.5-px colored dot beside a label conveys state. No pill backgrounds, no full-width tints.',
  },
  {
    title: 'No motion as decoration',
    body: 'No card lift, no stagger fade, no gradient shift. Animation only confirms an action just taken.',
  },
  {
    title: 'One weight ladder',
    body: 'semibold for titles, medium for values, regular for body. Never bold for chrome labels.',
  },
  {
    title: 'Numerals with weight',
    body: 'Tabular figures, medium weight, larger size. Numbers are the data — they should out-weigh the labels.',
  },
  {
    title: 'Single accent, vivid',
    body: "Indigo for primary affordance, emerald/amber/rose for status. No gradients, no rainbows.",
  },
]

export default function DesignPreviewPage() {
  const [stickyOpen, setStickyOpen] = useState<'before' | 'after'>('after')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
      <PageHeader
        title="Design preview"
        description="Sandbox for the audited visual refinements. Not linked from anywhere — visit /design-preview directly. Each row pairs the current production pattern (left) with the proposed refinement (right)."
      />

      {/* ─── Principles strip ─── */}
      <Card className="overflow-hidden p-0 shadow-none">
        <div className="border-b border-border/60 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Design principles
          </p>
        </div>
        <ul className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="space-y-1 px-5 py-4">
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {/* ─── Comparison toggle (cosmetic, just frames the layout) ─── */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Reading order:</span>
        <button
          onClick={() => setStickyOpen('before')}
          className={cn(
            'rounded-md px-2 py-1 font-medium transition-colors',
            stickyOpen === 'before'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Before-led
        </button>
        <button
          onClick={() => setStickyOpen('after')}
          className={cn(
            'rounded-md px-2 py-1 font-medium transition-colors',
            stickyOpen === 'after'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          After-led
        </button>
        <span className="ml-auto text-muted-foreground">
          (cosmetic — both render below)
        </span>
      </div>

      {/* ─── Sample sections ─── */}
      <div className="space-y-12">
        <Section
          title="1 · Stat cards"
          description="Drop the icon-chip, gradient surface, and lift-on-hover. One card with hairline cells; status conveyed by a 1.5-px dot."
          before={<StatCardsBefore />}
          after={<StatCardsAfter />}
        />

        <Section
          title="2 · Quick actions"
          description="Three flat tiles with a hairline border. Replace gradient icon chips with a small monochrome icon and an arrow affordance."
          before={<QuickActionsBefore />}
          after={<QuickActionsAfter />}
        />

        <Section
          title="3 · Hero greeting (TodayHero)"
          description="No gradient surface, no tinted stat tiles. Date as eyebrow + name as title; key numbers right-aligned with hairline divider."
          before={<HeroBefore />}
          after={<HeroAfter />}
        />

        <Section
          title="4 · Project header"
          description="Drop the multi-color accent bar and gradient avatar. Single hairline rule above an uppercase 'Project' eyebrow."
          before={<ProjectHeaderBefore />}
          after={<ProjectHeaderAfter />}
        />

        <Section
          title="5 · Birthday banner"
          description="Confetti + emoji + multi-color gradient feels out of place in enterprise. Replace with a one-line acknowledgment + outbound action."
          before={<BirthdayBefore />}
          after={<BirthdayAfter />}
        />

        <Section
          title="6 · Empty state"
          description="No gradient background, no bouncing icon. Hairline dashed frame + one icon at body weight + an action."
          before={<EmptyBefore />}
          after={<EmptyAfter />}
        />

        <Section
          title="7 · Status badges"
          description="Pill chips with bullet dots are gamified. Use a colored dot + colored text — same semantic, half the visual weight."
          before={<BadgeBefore />}
          after={<BadgeAfter />}
        />

        <Section
          title="8 · AI summary block"
          description="Replace gradient surface + glowing pill with a flat surface, an indigo top hairline, and a small monochrome Sparkles mark."
          before={<AiSummaryBefore />}
          after={<AiSummaryAfter />}
        />
      </div>

      {/* ─── Footer notes ─── */}
      <Card className="space-y-3 p-6 shadow-none">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          What gets removed (cross-cutting)
        </p>
        <ul className="space-y-2 text-sm text-foreground">
          {[
            <>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">stagger-up</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">stagger-rise</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">hover-lift-sm</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">icon-pop</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">animate-breathe</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">animate-confetti</code>
              ,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">animate-gradient-shift</code>
              {' '}from globals.css. Every consumer becomes a no-op.
            </>,
            <>Multi-color gradient backgrounds in <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">TodayHero</code>, <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">QuickActions</code>, <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">SetupChecklist</code>, <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">ProjectHeader</code>.</>,
            <>Gradient icon-in-square chips replaced with bare monochrome lucide icons at <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">strokeWidth={1.8}</code>.</>,
            <>Pill-shaped status badges replaced with dot + text; size drops from 24-28 px tall to ~14 px.</>,
            <>Birthday banner becomes a single-line dashboard greeting; confetti delete entirely.</>,
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-[11px] text-muted-foreground">
          When you approve a section, the corresponding production file gets the
          same treatment in a follow-up edit. Delete this folder once migration is
          complete.
        </p>
      </Card>
    </div>
  )
}
