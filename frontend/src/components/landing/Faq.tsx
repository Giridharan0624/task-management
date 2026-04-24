'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Globe,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Reveal } from '@/components/landing/Reveal'
import { cn } from '@/lib/utils'

type FaqCategory = 'Plans' | 'Capabilities' | 'Security' | 'Setup'

interface FaqItem {
  q: string
  a: string
  category: FaqCategory
}

// Source of truth for the landing-page FAQ. Each entry is tagged with
// a category so users can filter the list down — eleven questions read
// fine when scanned end-to-end, but a procurement reviewer scanning
// only Security questions appreciates the filter pills.
const FAQS: FaqItem[] = [
  {
    category: 'Plans',
    q: 'How much does TaskFlow cost?',
    a: 'Free for teams up to 10 members and 3 projects, with no card required and no time limit. Pro adds higher caps (50 members and 50 projects), screenshots, custom roles, custom pipelines, HMAC-signed webhooks, and a 365-day audit-log retention. Enterprise lifts every cap and adds white-label branding, named CSM, SLA, and procurement support — with SAML/OIDC SSO, SCIM, and custom domain on the near-term roadmap. See the pricing section above for full feature lists.',
  },
  {
    category: 'Plans',
    q: 'What happens when my Free workspace hits 10 members or 3 projects?',
    a: 'The next invite or project creation is rejected at the API with a clear "your Free plan is limited to {N} {users/projects}" error — no silent degradation. Existing members and projects keep working. Upgrade to Pro to lift the cap; existing data is untouched and no migration is needed.',
  },
  {
    category: 'Capabilities',
    q: 'How does the AI weekly rollup work?',
    a: 'Owners and admins can open the weekly digest from the Reports tab. The system aggregates seven days of task updates, attendance, activity, and day-off records into deterministic metrics (hours, contributors, missing days, presence/intensity scores), then asks an LLM to write a short editorial recap around those numbers. The AI is explicitly forbidden from inventing figures — it only writes prose around what the math has already produced. Available on every plan, including Free.',
  },
  {
    category: 'Security',
    q: 'Is two-factor authentication supported?',
    a: 'Yes, on every plan. Members can enrol a TOTP authenticator (Google Authenticator, 1Password, Authy, etc.) from their profile. Owners can enforce 2FA workspace-wide. Recovery codes are generated at enrolment so a lost authenticator does not lock anyone out.',
  },
  {
    category: 'Security',
    q: 'Is there an audit log?',
    a: 'Yes. Every privileged action — role changes, member removals, ownership transfers, settings edits — is recorded with the actor, target, and rule identifier, with filters by action and date range. The viewer is included on every plan; retention differs by plan (30 days on Free, 365 days on Pro, unlimited on Enterprise). Audit events are bundled into the full-workspace JSON export today; a standalone CSV export from the audit page is on the roadmap.',
  },
  {
    category: 'Capabilities',
    q: 'Can I define custom roles beyond owner / admin / member?',
    a: 'Yes — on Pro and Enterprise. The three default roles cover most teams; Pro adds the ability to clone any default role and edit its permission set field-by-field, or build a new role from scratch. Custom roles are scoped to your workspace and never affect other tenants.',
  },
  {
    category: 'Security',
    q: 'Do we own our data, and can we export it?',
    a: 'Yes. Every list view supports CSV export. A full-workspace export covering users, projects, tasks, attendance, time-off records, and audit log is available as a single JSON archive from the workspace settings page.',
  },
  {
    category: 'Security',
    q: 'How is our data isolated from other tenants?',
    a: 'Every database record is prefixed with your organization identifier. Each authenticated request re-reads the requesting user’s role from DynamoDB rather than trusting the JWT claim alone. Uploads reside under your organization’s S3 prefix, and the presigned-URL handler rejects any key outside that scope.',
  },
  {
    category: 'Setup',
    q: 'Can TaskFlow be hosted on our own infrastructure?',
    a: 'Self-hosting is not formally supported at this time. The backend runs on Python Lambda, DynamoDB, and AWS CDK, so a technical team can adapt the infrastructure to run in its own AWS account. A packaged self-hosting option is on our roadmap.',
  },
  {
    category: 'Setup',
    q: 'Does TaskFlow support multiple teams within a single workspace?',
    a: 'One workspace corresponds to one team. Within a workspace you can create any number of projects, each with its own membership and roles. Organizations operating multiple business units should provision a separate workspace per unit to maintain full data isolation.',
  },
  {
    category: 'Setup',
    q: 'What happens when a user signs out of the desktop application?',
    a: 'Active sessions are finalized at sign-out, and recorded hours are attributed to the day of clock-in. If the application is force-closed, a nightly process closes any orphaned sessions so timesheets remain accurate.',
  },
]

// Per-category tone — picks an accent that matches the category's
// vibe without breaking the page's overall palette. The 'All' entry
// uses the brand primary so the active filter chip always reads as
// "this is the entry point".
const CATEGORY_TONE: Record<
  FaqCategory | 'All',
  { dot: string; chip: string; chipActive: string; ring: string }
> = {
  All: {
    dot: 'bg-primary',
    chip: 'border-primary/30 bg-primary/10 text-primary',
    chipActive: 'border-primary bg-primary text-primary-foreground shadow-md',
    ring: 'ring-primary/30',
  },
  Plans: {
    dot: 'bg-emerald-500',
    chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    chipActive: 'border-emerald-500 bg-emerald-500 text-white shadow-md',
    ring: 'ring-emerald-500/30',
  },
  Capabilities: {
    dot: 'bg-indigo-500',
    chip: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    chipActive: 'border-indigo-500 bg-indigo-500 text-white shadow-md',
    ring: 'ring-indigo-500/30',
  },
  Security: {
    dot: 'bg-rose-500',
    chip: 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    chipActive: 'border-rose-500 bg-rose-500 text-white shadow-md',
    ring: 'ring-rose-500/30',
  },
  Setup: {
    dot: 'bg-amber-500',
    chip: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    chipActive: 'border-amber-500 bg-amber-500 text-white shadow-md',
    ring: 'ring-amber-500/30',
  },
}

const CATEGORY_ORDER: ('All' | FaqCategory)[] = [
  'All',
  'Plans',
  'Capabilities',
  'Security',
  'Setup',
]

const CATEGORY_LABEL: Record<'All' | FaqCategory, string> = {
  All: 'All',
  Plans: 'Plans & pricing',
  Capabilities: 'Capabilities',
  Security: 'Security & data',
  Setup: 'Setup & operations',
}

export function Faq() {
  const [activeCategory, setActiveCategory] = useState<'All' | FaqCategory>('All')
  const [query, setQuery] = useState('')
  // Open the first match by default — empty state of an FAQ list with
  // every question collapsed feels lifeless. Re-keyed on filter change
  // so the user always sees an opened answer in the new context.
  const [openKey, setOpenKey] = useState<string | null>(FAQS[0].q)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FAQS.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) return false
      if (!q) return true
      return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    })
  }, [activeCategory, query])

  // Counts per category power the filter pills' badge.
  const counts = useMemo(() => {
    const c: Record<'All' | FaqCategory, number> = {
      All: FAQS.length,
      Plans: 0,
      Capabilities: 0,
      Security: 0,
      Setup: 0,
    }
    for (const f of FAQS) c[f.category] += 1
    return c
  }, [])

  const handleCategoryChange = (cat: 'All' | FaqCategory) => {
    setActiveCategory(cat)
    // Open whichever question lands at index 0 of the filtered set.
    // Done in a microtask via setOpenKey so the user sees an answer
    // immediately after switching, never an empty list of headers.
    const next = FAQS.find(
      (f) => cat === 'All' || f.category === cat,
    )
    setOpenKey(next?.q ?? null)
  }

  return (
    <section
      id="faq"
      className="relative overflow-hidden border-b border-border/60 py-14 sm:py-20"
    >
      {/* Background accents — soft, off-axis so the section reads as
          its own surface rather than a continuation of the previous one. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-12 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 bottom-20 -z-10 h-80 w-80 rounded-full bg-fuchsia-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[1px] w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-border to-transparent opacity-60"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          {/* ─── LEFT: heading + support panel ─── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Reveal direction="up">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur-xl">
                <Sparkles className="h-3 w-3" />
                FAQ
              </div>
            </Reveal>
            <Reveal direction="up" delay={80}>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Questions,{' '}
                <span
                  className="bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-transparent animate-gradient-shift"
                  style={{ backgroundSize: '200% 200%' }}
                >
                  answered.
                </span>
              </h2>
            </Reveal>
            <Reveal direction="up" delay={160}>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The questions we are asked most often. Filter by topic or
                search the body — and if your question still isn’t covered,
                our team responds within one business day.
              </p>
            </Reveal>

            <Reveal direction="up" delay={240}>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/55 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_40px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                <a
                  href="mailto:support@neurostack.in"
                  className="group/cta flex items-start gap-3 border-b border-border/60 px-4 py-3.5 transition-colors hover:bg-primary/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
                    <Mail className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      Email support
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      support@neurostack.in
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:text-primary" />
                </a>
                <a
                  href="https://neurostack.in"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group/cta flex items-start gap-3 border-b border-border/60 px-4 py-3.5 transition-colors hover:bg-primary/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
                    <Globe className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      Visit NEUROSTACK
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      Company site & engagements
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:text-emerald-500" />
                </a>
                <a
                  href="mailto:support@neurostack.in?subject=TaskFlow%20product%20question"
                  className="group/cta flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-primary/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-600 ring-1 ring-inset ring-fuchsia-500/20 dark:text-fuchsia-300">
                    <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      Talk to a human
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      Pre-sales, security review, custom plans
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:text-fuchsia-500" />
                </a>
              </div>
            </Reveal>

            <Reveal direction="up" delay={320}>
              <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Average reply time · under 4 hours
              </p>
            </Reveal>
          </aside>

          {/* ─── RIGHT: search + filter pills + question list ─── */}
          <div>
            <Reveal direction="up">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the FAQ — try “2FA”, “audit”, “seats”…"
                  className="h-11 w-full rounded-2xl border border-white/55 bg-white/45 pl-10 pr-10 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl transition-all focus:border-primary/50 focus:bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/[0.04]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Reveal>

            <Reveal direction="up" delay={80}>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {CATEGORY_ORDER.map((cat) => {
                  const tone = CATEGORY_TONE[cat]
                  const active = cat === activeCategory
                  const count = counts[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={cn(
                        'group/pill inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all',
                        active
                          ? cn(tone.chipActive, '-translate-y-0.5')
                          : cn(
                              'border-border bg-white/40 text-foreground/80 backdrop-blur hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-white/60 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
                            ),
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'h-1.5 w-1.5 rounded-full transition-colors',
                          active ? 'bg-current' : tone.dot,
                        )}
                      />
                      {CATEGORY_LABEL[cat]}
                      <span
                        className={cn(
                          'ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                          active
                            ? 'bg-white/20 text-current'
                            : 'bg-muted/60 text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Reveal>

            {/* Question list */}
            <div className="mt-6 space-y-2.5">
              {filtered.length === 0 ? (
                <Reveal direction="up">
                  <div className="rounded-2xl border border-dashed border-border/70 bg-white/30 px-5 py-10 text-center backdrop-blur-xl dark:bg-white/[0.02]">
                    <p className="text-sm font-semibold text-foreground">
                      No question matches “{query}”
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Try a broader term, or{' '}
                      <a
                        href="mailto:support@neurostack.in"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        ask us directly
                      </a>
                      .
                    </p>
                  </div>
                </Reveal>
              ) : (
                filtered.map((item, i) => (
                  <Reveal key={item.q} direction="up" delay={i * 35}>
                    <FaqCard
                      item={item}
                      index={i}
                      isOpen={openKey === item.q}
                      onToggle={() =>
                        setOpenKey(openKey === item.q ? null : item.q)
                      }
                    />
                  </Reveal>
                ))
              )}
            </div>

            <Reveal direction="up" delay={200}>
              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                Showing{' '}
                <span className="font-semibold text-foreground">
                  {filtered.length}
                </span>{' '}
                of {FAQS.length} questions
                {activeCategory !== 'All' && (
                  <>
                    {' '}
                    in{' '}
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('All')}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {CATEGORY_LABEL[activeCategory]}
                    </button>
                  </>
                )}
                {query && (
                  <>
                    {' '}
                    matching “
                    <span className="font-semibold text-foreground">
                      {query}
                    </span>
                    ”
                  </>
                )}
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

interface FaqCardProps {
  item: FaqItem
  index: number
  isOpen: boolean
  onToggle: () => void
}

function FaqCard({ item, index, isOpen, onToggle }: FaqCardProps) {
  const tone = CATEGORY_TONE[item.category]
  const panelId = `faq-panel-${index}`
  const buttonId = `faq-button-${index}`

  return (
    <div
      className={cn(
        'group/card overflow-hidden rounded-2xl border backdrop-blur-xl transition-all',
        isOpen
          ? cn(
              'border-primary/40 bg-gradient-to-br from-primary/[0.07] to-accent/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_22px_48px_-24px_rgba(99,102,241,0.35)]',
            )
          : 'border-white/55 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-white/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
      )}
    >
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        {/* Index ribbon — small monospace counter that reads as a
            navigational aid; turns brand-coloured when the card opens. */}
        <span
          aria-hidden
          className={cn(
            'mt-0.5 shrink-0 font-mono text-[11px] font-bold tabular-nums transition-colors',
            isOpen ? 'text-primary' : 'text-muted-foreground/70',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          {/* Category tag — visible at all times so a scanner knows
              what bucket each question lives in without opening it. */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
              tone.chip,
            )}
          >
            <span
              aria-hidden
              className={cn('h-1 w-1 rounded-full', tone.dot)}
            />
            {item.category}
          </span>
          <p className="mt-1.5 text-[14px] font-semibold leading-snug text-foreground">
            {item.q}
          </p>
        </div>

        {/* Plus → minus indicator. Two crossed bars so the open state
            is recognisable without depending on the chevron metaphor. */}
        <span
          aria-hidden
          className={cn(
            'relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all',
            isOpen
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted/40 text-foreground/70 group-hover/card:bg-muted/60',
          )}
        >
          <span
            className={cn(
              'absolute h-3 w-[1.6px] bg-current transition-transform duration-300',
              isOpen ? 'scale-y-0' : 'scale-y-100',
            )}
          />
          <span className="absolute h-[1.6px] w-3 bg-current" />
        </span>
      </button>

      {/* Smooth height animation via the grid-rows trick — no measured
          heights, no JS-driven max-height, works without ResizeObserver
          and respects prefers-reduced-motion via the consumer's CSS. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={cn(
          'grid transition-all duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/40 px-5 pl-[60px] pr-12 pb-5 pt-4 text-[13.5px] leading-relaxed text-muted-foreground">
            {item.a}
          </div>
        </div>
      </div>
    </div>
  )
}
