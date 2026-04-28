import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Activity,
  Apple,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Globe,
  KanbanSquare,
  KeyRound,
  Layers,
  Mail,
  MessageSquare,
  Monitor,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Terminal,
  TrendingDown,
  Users,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { MaybeRedirectIfAuthed } from '@/components/landing/MaybeRedirectIfAuthed'
import { Reveal } from '@/components/landing/Reveal'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'
import { HeroTaskMockup } from '@/components/landing/HeroTaskMockup'
import { Faq } from '@/components/landing/Faq'
import {
  ActivityWaveform,
  MouseSpotlight,
  TiltCard,
  TypewriterText,
} from '@/components/landing/interactions'
import { cn } from '@/lib/utils'

// Note: this page used to hardcode Lexend via next/font, but that
// overrode the tenant-font cascade for any logged-in user landing
// here. The page now inherits the app-wide font (tenant choice when
// set, otherwise the bundled Outfit) like every other surface.

/* ────────────────────────────────────────────────────────────────────
 * Page metadata + structured data
 * ──────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'TaskFlow — Unified task, time, and team operations platform',
  description:
    'Plan work, track time, manage attendance and time off, and review daily output in a single workspace. Provision in minutes; includes a desktop companion for accurate time capture.',
  keywords: [
    'task management',
    'time tracking',
    'attendance',
    'daily standups',
    'team operations',
    'project management',
    'SaaS',
  ],
  openGraph: {
    title: 'TaskFlow — Unified task, time, and team operations platform',
    description:
      'A single workspace for tasks, attendance, daily summaries, and time off. Free to start.',
    type: 'website',
    siteName: 'TaskFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskFlow — Unified task, time, and team operations platform',
    description:
      'A single workspace for tasks, attendance, daily summaries, and time off.',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TaskFlow',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Windows, macOS, Linux',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Tasks, time tracking, attendance, and daily updates in one app — replaces the four tools your team is duct-taping together today.',
}

/* ────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MaybeRedirectIfAuthed />

      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-lg"
      >
        Skip to main content
      </a>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <LandingHeader />

      <main
        id="main-content"
        tabIndex={-1}
        // Compensates for the fixed LandingHeader:
        //  - base (mobile/tablet): 64px top bar + ~40px mobile pill row ≈ 104px
        //  - lg+: just the 64px bar (the pill row is lg:hidden)
        // `overflow-x-hidden` lives here (not on the outer wrapper) so the
        // fixed LandingHeader stays viewport-anchored. Placing overflow on
        // an ancestor of a fixed element creates a containing block in
        // some browsers (notably Safari / iOS), which causes the "fixed"
        // header to scroll with the page.
        className="flex-1 overflow-x-hidden pt-[104px] focus-visible:outline-none lg:pt-16"
      >
        <Hero />
        <ProblemSection />
        <SolutionPillars />
        <Differentiator />
        <FeatureGrid />
        <DesktopDownload />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Hero
 * ──────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <MouseSpotlight
      className="relative overflow-hidden border-b border-border/60"
      size={520}
    >
      <section className="relative">
        {/* Atmospheric backdrop — replaces the four bouncing blur orbs
            and the slow-spin concentric rings with a single calm
            gradient mesh. Three soft color anchors drifting at
            different speeds is enough atmosphere; more was theatre. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute -left-[15%] top-[8%] h-[520px] w-[520px] rounded-full bg-primary/20 blur-[120px] animate-drift-slow"
            style={{ animationDelay: '-2s' }}
          />
          <div
            className="absolute -right-[10%] top-[30%] h-[440px] w-[440px] rounded-full bg-accent/20 blur-[120px] animate-drift-slower"
            style={{ animationDelay: '-6s' }}
          />
          {/* Hairline grid texture — barely visible at full zoom but
              gives the page a sense of architectural structure under
              the soft color. CSS-only, no image asset. */}
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              backgroundPosition: '-1px -1px',
              maskImage:
                'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent 80%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent 80%)',
            }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-28">
          <div>
            {/* Eyebrow — flat tracked-uppercase label with a leading
                bullet, replaces the glass pill chip. Reads as a
                category label, not a sticker. */}
            <Reveal direction="up">
              <div className="mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                <span
                  aria-hidden
                  className="h-px w-6 bg-primary/60"
                />
                One app for project teams
              </div>
            </Reveal>

            {/* Headline — single-color foreground (gradient text was
                dated and clashed with the tenant theme system).
                Tracking-tight and a refined font weight. The break
                between lines is intentional rhythm, not a wrap. */}
            <Reveal direction="up" delay={80}>
              <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] text-foreground sm:text-[56px] lg:text-[64px]">
                One workspace for{' '}
                <span className="text-foreground/70">tasks,</span>{' '}
                <span className="text-foreground/70">time,</span>{' '}
                <span className="text-foreground/70">and</span>{' '}
                <span className="relative inline-block whitespace-nowrap">
                  team ops
                  {/* Hand-drawn underline — SVG so it scales with the
                      type. Subtle primary accent without resorting
                      to gradient text. */}
                  <svg
                    aria-hidden
                    viewBox="0 0 220 12"
                    className="absolute -bottom-1 left-0 h-3 w-full text-primary/70"
                    fill="none"
                  >
                    <path
                      d="M2 8 C 60 2, 140 2, 218 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h1>
            </Reveal>

            <Reveal direction="up" delay={160}>
              <p className="mt-6 max-w-[500px] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                Your project tracker, your timer, your leave manager,
                and your weekly reports — one URL, one bill, one
                login. The desktop app logs the hours so nobody fills
                a timesheet on Friday.
              </p>
            </Reveal>

            <Reveal direction="up" delay={240}>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                {/* Primary CTA — hairline border around solid primary,
                    no glassmorphic shadow, no hover-lift. Arrow
                    nudges on hover for tactile affordance. */}
                <Link
                  href="/signup"
                  className="group inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Start free
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Link>
                {/* Secondary — text link with arrow, no chrome. The
                    "two equal CTAs" anti-pattern is gone; sign-in is
                    clearly the lower-priority action. */}
                <Link
                  href="/login"
                  className="group inline-flex h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign in to your workspace
                  <ArrowUpRight
                    className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={1.8}
                  />
                </Link>
              </div>
            </Reveal>

            {/* Trust strip — three signals as dot+text instead of
                a single muted line. Each item gets its own concrete
                claim, so the strip feels like a feature row, not a
                disclaimer. */}
            <Reveal direction="up" delay={320}>
              <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600"
                    strokeWidth={1.8}
                  />
                  No card required
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600"
                    strokeWidth={1.8}
                  />
                  Workspace ready in under a minute
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600"
                    strokeWidth={1.8}
                  />
                  Cancel anytime
                </li>
              </ul>
            </Reveal>
          </div>

          <Reveal direction="left" delay={200} className="lg:pl-8">
            <HeroTaskMockup />
          </Reveal>
        </div>
      </section>
    </MouseSpotlight>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Problem — the pain before TaskFlow
 * ──────────────────────────────────────────────────────────────────── */

function ProblemSection() {
  const pains = [
    {
      icon: Shuffle,
      title: 'Tool fragmentation taxes the day.',
      blurb:
        'A task tool, a separate timer, an inbox for leave requests, a spreadsheet for reports. Switching between them quietly costs more time than the work they were bought to support.',
      tone: 'text-rose-600 dark:text-rose-300',
      ring: 'ring-rose-500/20',
      bg: 'bg-rose-500/10',
    },
    {
      icon: MessageSquare,
      title: 'Visibility runs on memory.',
      blurb:
        'Standups turn into end-of-day recall exercises. By the time a manager pieces together what shipped, the detail that matters is already gone.',
      tone: 'text-amber-600 dark:text-amber-300',
      ring: 'ring-amber-500/20',
      bg: 'bg-amber-500/10',
    },
    {
      icon: TrendingDown,
      title: 'Timesheets rarely match reality.',
      blurb:
        'Hours typed in on Friday are guesses. Hours captured while you actually worked aren&apos;t. Without the second number, billing reviews turn into arguments nobody wins.',
      tone: 'text-slate-600 dark:text-slate-300',
      ring: 'ring-slate-500/20',
      bg: 'bg-slate-500/10',
    },
    {
      // Fourth pain — matches the "four disconnected systems" headline
      // and the "inbox for leave requests" tool named in card #1.
      icon: Calendar,
      title: 'Leave lives in your inbox.',
      blurb:
        'Approvals, balances, and return dates scatter across email threads and HR spreadsheets. To find out who&apos;s out this week, someone ends up posting to Slack instead of opening a system.',
      tone: 'text-sky-600 dark:text-sky-300',
      ring: 'ring-sky-500/20',
      bg: 'bg-sky-500/10',
    },
  ]

  return (
    <section
      id="problem"
      className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-14 sm:py-20"
    >
      {/* Atmosphere — soft coloured orbs so the glass cards below have
          something to refract. Without this the glass would be invisible
          against the flat muted background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-12 -z-10 h-72 w-72 rounded-full bg-rose-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] bottom-16 -z-10 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[40%] top-[35%] -z-10 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              The current state
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Running a team shouldn&apos;t take four logins.
            </h2>
          </Reveal>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pains.map((p, i) => (
            <Reveal key={p.title} direction="up" delay={i * 80}>
              <li className="group relative h-full overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_14px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/70 hover:bg-white/55 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_20px_50px_-20px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                {/* Top-edge shine — classic glass specular highlight */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
                />
                <div
                  className={cn(
                    'mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset backdrop-blur-md',
                    p.bg,
                    p.ring
                  )}
                >
                  <p.icon className={cn('h-5 w-5', p.tone)} strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.blurb}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal direction="up" delay={320}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-base text-foreground/80 sm:text-lg">
            TaskFlow does all four{' '}
            <span className="font-semibold text-foreground">in one app</span>.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Solution — three pillars
 * ──────────────────────────────────────────────────────────────────── */

function SolutionPillars() {
  const pillars = [
    {
      icon: Clock,
      title: 'Capture.',
      body: 'The desktop app records hours, activity signals, and (optionally) periodic screenshots while you work. No timesheets, no end-of-week guesswork.',
      tint: 'from-primary/20 via-primary/5 to-transparent',
      iconTint: 'bg-primary/15 text-primary',
    },
    {
      icon: Brain,
      title: 'Understand.',
      body: 'AI summaries roll up each member&apos;s day — what shipped, hours per task, blockers — into a single readable digest. Managers get the answers before they have to ask the questions.',
      tint: 'from-accent/20 via-accent/5 to-transparent',
      iconTint: 'bg-accent/15 text-accent',
    },
    {
      icon: BarChart3,
      title: 'Report.',
      body: 'Cross-project hours, per-member breakdowns, CSV exports, deep-linkable filters. Every view of the week is a URL you can paste into a Slack thread.',
      tint: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
      iconTint: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
    },
  ]

  return (
    <section className="relative border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One app. <span className="text-foreground/70">Three jobs.</span>
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-3 text-base text-muted-foreground">
              Capture the work as it happens. Understand what got done.
              Report it without anyone reformatting a spreadsheet.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} direction="up" delay={i * 100}>
              <TiltCard maxTilt={4} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity duration-500 group-hover:opacity-100',
                      p.tint
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/0 blur-3xl transition-colors duration-500 group-hover:bg-primary/20"
                  />

                  <div className="relative">
                    <div
                      className={cn(
                        'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/20 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6',
                        p.iconTint
                      )}
                    >
                      <p.icon className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {p.body}
                    </p>
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Differentiator — three live-demo blocks, alternating
 * ──────────────────────────────────────────────────────────────────── */

function Differentiator() {
  return (
    <section
      id="differentiator"
      className="relative overflow-hidden border-b border-border/60 py-14 sm:py-20"
    >
      {/* Very subtle background wash so the section has its own identity
          without adding another drifting blob. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.025] via-transparent to-accent/[0.025]"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <span aria-hidden className="h-px w-6 bg-primary/60" />
              Why teams pick us
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Three things a generic task tracker can&apos;t do.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              If your team bills by the hour, ships against deadlines, or
              answers to a client about how time was spent — these are the
              parts you can&apos;t fake with sticky notes.
            </p>
          </Reveal>
        </div>

        <div className="space-y-16 lg:space-y-20">
          <DemoRow
            step="01"
            badge="Objective activity signals"
            badgeIcon={Activity}
            theme={{
              badge:
                'text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
              chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/20',
              gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
              halo: 'bg-fuchsia-500/15',
            }}
            titleLead="See actual focus time"
            titleAccent="not just hours logged."
            blurb="The desktop app counts keystrokes and mouse events while a timer is running — never the keys themselves, just the count. The dashboard turns those counters into a per-session activity score so idle time stops counting as work."
            bullets={[
              'Activity score per session — replaces self-reported productivity',
              'Runs in the background; no extra monitoring software to install',
              'Counts events only — no keystrokes, no clipboard, no content',
            ]}
            visual={<ActivityDemo />}
          />

          <DemoRow
            reverse
            step="02"
            badge="AI-generated summaries"
            badgeIcon={Brain}
            theme={{
              badge:
                'text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/20',
              chip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20',
              gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
              halo: 'bg-purple-500/15',
            }}
            titleLead="Daily updates"
            titleAccent="that write themselves."
            blurb="At end of day, an AI reads each member&apos;s session log — tasks closed, hours per task, comments — and drafts the daily update. The member reviews, edits if they want, hits submit. Managers stop chasing recap emails."
            bullets={[
              'Drafted from real session data — not vibes, not guesses',
              'Run server-side at sign-out; the AI key never touches the browser',
              'Member edits before submitting — AI is a starting point, not the source of truth',
            ]}
            visual={<AiDemo />}
          />

          <DemoRow
            step="03"
            badge="Tenant-scoped storage"
            badgeIcon={Camera}
            theme={{
              badge:
                'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/20',
              chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20',
              gradient: 'from-sky-500 via-blue-500 to-indigo-500',
              halo: 'bg-blue-500/15',
            }}
            titleLead="Spot-check the work"
            titleAccent="without breathing down necks."
            blurb="The desktop app takes a compressed screenshot every 9-10 minutes while the timer is running, uploaded straight into your workspace&apos;s own S3 prefix. Managers can verify deliverables without standing behind anyone&apos;s monitor."
            bullets={[
              'Scoped to your workspace prefix — no other tenant can read your captures',
              'Compressed JPEGs — a full day is a few megabytes, not gigabytes',
              'The capture loop stops the moment a member stops the timer',
            ]}
            visual={<ScreenshotDemo />}
          />
        </div>
      </div>
    </section>
  )
}

interface DemoRowTheme {
  /** Badge text + bg + border (applied to the pill above the headline). */
  badge: string
  /** Bullet-chip tint — applied to each checkmark+bullet card. */
  chip: string
  /** Tailwind gradient classes for the step-number treatment. */
  gradient: string
  /** Halo tint behind the demo frame — sells the color identity of the row. */
  halo: string
}

interface DemoRowProps {
  /** "01" · "02" · "03" — numbered rhythm for the sequence of three. */
  step: string
  badge: string
  badgeIcon: typeof Activity
  theme: DemoRowTheme
  /** Title split into a neutral lead + gradient-accented tail. */
  titleLead: string
  titleAccent: string
  blurb: string
  bullets: string[]
  visual: React.ReactNode
  reverse?: boolean
}

function DemoRow({
  step,
  badge,
  badgeIcon: BadgeIcon,
  theme,
  titleLead,
  titleAccent,
  blurb,
  bullets,
  visual,
  reverse,
}: DemoRowProps) {
  return (
    <div
      className={cn(
        // `minmax(0, 1fr)` overrides the default grid-cell min-width of
        // `auto`, which was letting the right column's visual (6 wide
        // tiles) push past its share and squeeze the text column down
        // to ~25% width. This forces a true 50/50 split regardless of
        // the visual's intrinsic width.
        'grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12',
        reverse && 'lg:grid-flow-dense'
      )}
    >
      <div className={cn('relative', reverse && 'lg:col-start-2')}>
        {/* Big decorative step number — anchors the copy side visually and
            gives the sequence a rhythm the eye follows down the page. */}
        <Reveal direction={reverse ? 'right' : 'left'}>
          <div
            aria-hidden
            className={cn(
              'mb-4 bg-gradient-to-r bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl',
              theme.gradient
            )}
            style={{ backgroundSize: '200% 200%' }}
          >
            {step}
          </div>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={60}>
          <div
            className={cn(
              'mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur',
              theme.badge
            )}
          >
            <BadgeIcon className="h-3 w-3" />
            {badge}
          </div>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={120}>
          <h3 className="text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {titleLead}{' '}
            <span
              className={cn(
                'bg-gradient-to-r bg-clip-text text-transparent',
                theme.gradient
              )}
              style={{ backgroundSize: '200% 200%' }}
            >
              {titleAccent}
            </span>
          </h3>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={180}>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {blurb}
          </p>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={240}>
          <ul className="mt-5 space-y-2">
            {bullets.map((b) => (
              <li
                key={b}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                  theme.chip
                )}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                <span className="text-foreground/90">{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal
        direction={reverse ? 'left' : 'right'}
        delay={120}
        className={cn('relative', reverse && 'lg:col-start-1 lg:row-start-1')}
      >
        {/* Per-row colored halo — subtle and blurred, gives the demo a sense
            of "belonging" to this row's theme without adding a hard border. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -inset-8 -z-10 rounded-[40px] blur-3xl opacity-70',
            theme.halo
          )}
        />
        <TiltCard maxTilt={4}>{visual}</TiltCard>
      </Reveal>
    </div>
  )
}

function DemoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl shadow-black/5 dark:shadow-black/30">
      {/* Soft top-edge highlight — cheap way to sell the "device" feel. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />
      {children}
    </div>
  )
}

function ActivityDemo() {
  return (
    <DemoFrame>
      <div className="flex items-end justify-between border-b border-border/60 p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Activity today
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            <AnimatedCounter to={87} suffix="%" /> active
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </div>
      </div>
      <div className="p-5">
        <ActivityWaveform />
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>9:00 AM</span>
          <span>1:00 PM</span>
          <span>5:00 PM</span>
        </div>
      </div>
    </DemoFrame>
  )
}

function AiDemo() {
  return (
    <DemoFrame>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Daily summary · April 21
          </p>
        </div>
        <TypewriterText
          className="text-[13px] text-foreground/90"
          speed={18}
          linePause={160}
          lines={[
            '> Processing 3 sessions across 2 projects…',
            '',
            '✓ Payments · Stripe Connect onboarding (2h 9m)',
            '  — Completed the branching onboarding form and',
            '    integrated KYC redirect. Error handling in review.',
            '',
            '✓ Marketing · Hero imagery refresh (1h 53m)',
            '  — Prepared three variants; final selection with @priya.',
            '',
            'Activity · 87%   Screenshots · 42   Status · Submitted',
          ]}
        />
      </div>
    </DemoFrame>
  )
}

/**
 * Each screenshot mock gets its own palette so the row of captures
 * reads like a real archive of different apps (doc, editor, chat,
 * design tool…) rather than six identical coloured grids. The last
 * tile is the freshest — marked LIVE with a pulse dot.
 */
const SCREENSHOT_TILES: {
  bar: string
  title: string
  accent: string
  line: string
  block: string
  age: string
  live?: boolean
}[] = [
  {
    bar: 'bg-rose-50',
    title: 'bg-rose-200/80',
    accent: 'bg-rose-200',
    line: 'bg-rose-100',
    block: 'bg-gradient-to-br from-rose-200 to-pink-200',
    age: '2h ago',
  },
  {
    bar: 'bg-amber-50',
    title: 'bg-amber-200/80',
    accent: 'bg-amber-200',
    line: 'bg-amber-100',
    block: 'bg-gradient-to-br from-amber-200 to-orange-200',
    age: '1h 30m',
  },
  {
    bar: 'bg-emerald-50',
    title: 'bg-emerald-200/80',
    accent: 'bg-emerald-200',
    line: 'bg-emerald-100',
    block: 'bg-gradient-to-br from-emerald-200 to-teal-200',
    age: '45m ago',
  },
  {
    bar: 'bg-sky-50',
    title: 'bg-sky-200/80',
    accent: 'bg-sky-200',
    line: 'bg-sky-100',
    block: 'bg-gradient-to-br from-sky-200 to-cyan-200',
    age: '20m ago',
  },
  {
    bar: 'bg-violet-50',
    title: 'bg-violet-200/80',
    accent: 'bg-violet-200',
    line: 'bg-violet-100',
    block: 'bg-gradient-to-br from-violet-200 to-fuchsia-200',
    age: '5m ago',
  },
  {
    bar: 'bg-primary/10',
    title: 'bg-primary/30',
    accent: 'bg-primary/25',
    line: 'bg-primary/10',
    block: 'bg-gradient-to-br from-primary/30 to-primary/15',
    age: 'now',
    live: true,
  },
]

function ScreenshotTile({
  tile,
  index,
}: {
  tile: (typeof SCREENSHOT_TILES)[number]
  index: number
}) {
  // Symmetric fan — leftmost and rightmost rotate outward; middle stays
  // level. Dropping slightly ({translateY}) on the outer tiles gives a
  // believable shelf-stack depth.
  const offset = index - (SCREENSHOT_TILES.length - 1) / 2
  const rotate = offset * 2.2
  const translateY = Math.abs(offset) * 2
  const zIndex = tile.live ? 20 : 10 - Math.abs(offset)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          // Responsive size so the full row of six tiles fits inside a
          // half-column on `lg` without forcing the grid to expand.
          'relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border/80 bg-white shadow-md sm:h-20 sm:w-24 xl:h-24 xl:w-32 dark:bg-[var(--color-surface)]',
          tile.live && 'ring-2 ring-primary/50',
        )}
        style={{
          transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
          zIndex,
        }}
      >
        {/* Window chrome */}
        <div
          className={cn(
            'flex items-center gap-1 px-1.5 py-1 border-b border-border/40',
            tile.bar,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          <span className={cn('ml-1 h-1.5 flex-1 rounded-full', tile.title)} />
        </div>

        {/* "Content" — rows of fake text + a hero block */}
        <div className="space-y-1 px-2 py-1.5">
          <span className={cn('block h-1 w-3/4 rounded-full', tile.line)} />
          <span className={cn('block h-1 w-full rounded-full', tile.line)} />
          <div className={cn('my-0.5 h-5 rounded', tile.block)} />
          <span className={cn('block h-1 w-5/6 rounded-full', tile.line)} />
          <span className={cn('block h-1 w-2/3 rounded-full', tile.line)} />
        </div>

        {/* LIVE badge on the freshest capture */}
        {tile.live && (
          <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-primary-foreground shadow">
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-80" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-primary-foreground" />
            </span>
            Live
          </span>
        )}
      </div>

      <span
        className={cn(
          'text-[9px] font-semibold tabular-nums transition-colors',
          tile.live
            ? 'text-primary'
            : 'text-muted-foreground/70',
        )}
      >
        {tile.age}
      </span>
    </div>
  )
}

function ScreenshotDemo() {
  return (
    <DemoFrame>
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Captured this session
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-300">
                <AnimatedCounter to={42} />
              </p>
              <span className="text-[11px] font-medium text-muted-foreground">
                screenshots
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            Tenant-scoped S3
          </span>
        </div>

        {/* `overflow-x-auto` is a belt-and-suspenders fallback in case the
            parent container gets narrower than the six-tile row can handle
            at its smallest size (e.g. very small mobile widths); scrollbar
            is visually hidden on desktop because the row already fits. */}
        <div className="-mx-2 flex items-end justify-start gap-2 overflow-x-auto px-2 py-3 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SCREENSHOT_TILES.map((tile, i) => (
            <ScreenshotTile key={i} tile={tile} index={i} />
          ))}
        </div>
      </div>
    </DemoFrame>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Feature grid — everything else, uniform compact cards
 * ──────────────────────────────────────────────────────────────────── */

// `tier` mirrors backend/src/contexts/org/domain/plans.py — features
// without a tier field are available on every plan (Free included).
// "Pro" gates `ai_summaries`, `screenshots`, `custom_roles`,
// `custom_pipelines`, `api_access`. "Enterprise" gates `sso`,
// `audit_logs`, `white_label`, `custom_domain`. Audit log itself is
// Free-included (capped at 30d retention); the Enterprise unlock is
// "audit_logs" custom retention.
type FeatureTier = 'Pro' | 'Enterprise'

interface FeatureCardData {
  icon: typeof KanbanSquare
  title: string
  blurb: string
  tint: string
  iconClass: string
  /** When set, the card shows a small tier badge — signals this
   *  capability requires the named plan or higher. */
  tier?: FeatureTier
}

const FEATURES: FeatureCardData[] = [
  {
    icon: KanbanSquare,
    title: 'Projects and Kanban',
    blurb:
      'List and board views with grouping by priority or deadline. Bulk assignment, bulk status updates, and reusable filter presets.',
    tint: 'from-indigo-500/15',
    iconClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  },
  {
    icon: Clock,
    title: 'Time tracking',
    blurb:
      'Start sessions from the web or desktop application. Cross-project reporting, CSV exports, and per-member performance summaries.',
    tint: 'from-emerald-500/15',
    iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  {
    icon: FileText,
    title: 'Daily reporting',
    blurb:
      'Submitted, pending, and overdue reports in a single view. Copy-ready reminders and a clear weekly overview.',
    tint: 'from-amber-500/15',
    iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  {
    icon: Brain,
    title: 'AI daily summaries & weekly rollups',
    blurb:
      'Daily per-member productivity summaries plus a weekly editorial digest covering task updates, attendance, and activity. Consistent with the math, never invents numbers.',
    tint: 'from-purple-500/15',
    iconClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
    tier: 'Pro',
  },
  {
    icon: Calendar,
    title: 'Time-off management',
    blurb:
      'Calendar-aware validation, duplicate protection, automatic approver routing, and one-click approval workflows.',
    tint: 'from-rose-500/15',
    iconClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
  {
    icon: Camera,
    title: 'Activity tracking & screenshots',
    blurb:
      'Aggregate keyboard / mouse counts (no keystroke content) plus periodic screenshot capture from the desktop companion. Composite presence-and-intensity score per member, per day.',
    tint: 'from-amber-500/15',
    iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    tier: 'Pro',
  },
  {
    icon: Layers,
    title: 'Custom pipelines',
    blurb:
      'Design task workflows specific to each project domain. Configure stages and assign colors to reflect real status.',
    tint: 'from-teal-500/15',
    iconClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-300',
    tier: 'Pro',
  },
  {
    icon: Shield,
    title: 'Custom roles & permissions',
    blurb:
      'Define your own roles beyond owner / admin / member with fine-grained per-feature permissions. Per-tenant, scoped to your workspace.',
    tint: 'from-cyan-500/15',
    iconClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
    tier: 'Pro',
  },
  {
    icon: Shuffle,
    title: 'HMAC-signed webhooks',
    blurb:
      'Subscribe external systems to project events. Stripe-compatible HMAC-SHA256 signing so existing webhook libraries work with minimal tweaks.',
    tint: 'from-orange-500/15',
    iconClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
    tier: 'Pro',
  },
  {
    icon: KeyRound,
    title: 'Two-factor authentication',
    blurb:
      'Optional TOTP enforcement for any member, backed by Cognito. Recovery codes generated at enrolment for lockout safety.',
    tint: 'from-fuchsia-500/15',
    iconClass: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
  },
  {
    icon: ClipboardList,
    title: 'Per-tenant audit log',
    blurb:
      'Every privileged action recorded with actor, target, and rule identifier. Filterable timeline; 30-day retention on Free, 365-day on Pro, unlimited on Enterprise.',
    tint: 'from-slate-500/15',
    iconClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  },
  {
    icon: Users,
    title: 'Multi-tenant workspaces',
    blurb:
      'Workspace-level isolation with configurable terminology, feature toggles, branding, and locale. No cross-tenant data exposure.',
    tint: 'from-violet-500/15',
    iconClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  },
  {
    icon: Download,
    title: 'Signed desktop installers',
    blurb:
      'Native applications for Windows, macOS, and Linux. Automatic updates and offline resilience — not a browser tab.',
    tint: 'from-lime-500/15',
    iconClass: 'bg-lime-500/15 text-lime-600 dark:text-lime-300',
  },
]

function FeatureGrid() {
  return (
    <section
      id="features"
      className="relative overflow-hidden border-b border-border/60 bg-muted/10 py-14 sm:py-20"
    >
      {/* Background atmosphere for the glass tiles to refract. The
          staggered colours give the grid subtle rainbow depth without
          reading as busy — each card picks up a different tint. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 -z-10 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[5%] top-[20%] -z-10 h-64 w-64 rounded-full bg-fuchsia-400/12 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[30%] bottom-[10%] -z-10 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-5%] bottom-[20%] -z-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              Everything you&apos;d normally pay four vendors for.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-3 text-base text-muted-foreground">
              One subscription, one workspace, one URL.{' '}
              <a
                href="#pricing"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                See what&apos;s in each plan ↓
              </a>
            </p>
          </Reveal>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} direction="up" delay={i * 40}>
              <li className="group relative h-full overflow-hidden rounded-3xl border border-white/50 bg-white/35 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_16px_40px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/70 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_24px_56px_-24px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">
                {/* Per-card gradient tint shows THROUGH the glass */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-90',
                    f.tint
                  )}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:bg-primary/25"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
                />

                <div className="relative flex h-full flex-col">
                  {/* Plan-tier badge — surfaces only for capabilities
                      gated behind Pro or Enterprise so the card doubles
                      as an upgrade signal. Free-included items render
                      without a badge to keep them visually unmarked. */}
                  {f.tier && (
                    <span
                      className={cn(
                        'absolute right-0 top-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur',
                        f.tier === 'Pro'
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'
                      )}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {f.tier}
                    </span>
                  )}
                  <div
                    className={cn(
                      'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/20 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6',
                      f.iconClass
                    )}
                  >
                    <f.icon className="h-6 w-6" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {f.blurb}
                  </p>

                  <Link
                    href="/signup"
                    className="touch-always-visible mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-primary opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    style={{ transform: 'translateY(6px)' }}
                  >
                    Start free
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Desktop download — dedicated section promoting the native companion
 * ──────────────────────────────────────────────────────────────────── */

function DesktopDownload() {
  const platforms = [
    {
      Icon: Monitor,
      name: 'Windows',
      tint: 'from-sky-500/20 via-blue-500/10 to-transparent',
      iconTint: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      ring: 'ring-sky-500/20',
    },
    {
      Icon: Apple,
      name: 'macOS',
      tint: 'from-slate-500/20 via-zinc-500/10 to-transparent',
      iconTint: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
      ring: 'ring-slate-500/20',
    },
    {
      Icon: Terminal,
      name: 'Linux',
      tint: 'from-amber-500/20 via-orange-500/10 to-transparent',
      iconTint: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
      ring: 'ring-amber-500/20',
    },
  ]

  const benefits = [
    'Start, stop, and switch tasks from your system tray',
    'Activity counters only — no keystrokes, no clipboard, no content',
    'Drafts the daily update from your session log when you sign out',
    'Works offline — queued sessions sync the moment you reconnect',
  ]

  return (
    <section
      id="desktop"
      className="relative overflow-hidden border-b border-border/60 py-14 sm:py-20"
    >
      {/* Layered background accents — consistent with the rest of the page
          but distinct enough to give this section its own mood. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/[0.025] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-drift-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl animate-drift-slower"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:px-8">
        {/* Left — copy + CTA */}
        <div>
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Download className="h-3 w-3" />
              Desktop companion
            </div>
          </Reveal>

          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              The work happens here. The desktop app captures it.
            </h2>
          </Reveal>

          <Reveal direction="up" delay={160}>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A signed installer for Windows, macOS, and Linux. It runs the
              timer, counts activity, takes the optional periodic
              screenshot, and queues the data for upload — even offline.
              No browser tab to forget.
            </p>
          </Reveal>

          <Reveal direction="up" delay={220}>
            <ul className="mt-6 space-y-2">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-foreground/90"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal direction="up" delay={280}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/download"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/90 px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_10px_20px_-8px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_14px_28px_-10px_rgba(99,102,241,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {/* Sweeping shine */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                <Download className="relative h-4 w-4" />
                <span className="relative">Download TaskFlow Desktop</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-xs text-muted-foreground">
                Free · Signed installers · Auto-updates
              </p>
            </div>
          </Reveal>

          <Reveal direction="up" delay={340}>
            <p className="mt-5 text-[11px] font-medium text-muted-foreground">
              Available for Windows 10+, macOS 12+, and major Linux
              distributions.
            </p>
          </Reveal>
        </div>

        {/* Right — layered platform cards, subtly 3D */}
        <Reveal direction="left" delay={200} className="relative">
          <div className="relative mx-auto max-w-md">
            {/* Decorative glow ring behind the card stack */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-gradient-to-br from-primary/20 via-accent/15 to-fuchsia-500/15 blur-3xl"
            />

            <div className="relative grid grid-cols-1 gap-4">
              {platforms.map((p, i) => (
                <div
                  key={p.name}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl',
                    // Stagger each card slightly on the X axis so they feel
                    // like a stack rather than a plain vertical list.
                    i === 0 && 'lg:ml-6',
                    i === 1 && 'lg:ml-0',
                    i === 2 && 'lg:ml-10'
                  )}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {/* Tinted wash specific to the platform */}
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80',
                      p.tint
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
                  />

                  <div className="relative flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
                        p.iconTint,
                        p.ring
                      )}
                    >
                      <p.Icon className="h-6 w-6" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Native build
                      </p>
                      <p className="text-lg font-bold tracking-tight text-foreground">
                        {p.name}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Ready
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * How it works
 * ──────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Spin up your workspace',
      blurb:
        'Pick a workspace code your team will sign in with. Set the theme, the leave types, the departments. About 60 seconds.',
    },
    {
      n: '02',
      title: 'Invite the team',
      blurb:
        'Send email invites. They set a password, land on their dashboard, and go. Roles decide what each person can see and edit.',
    },
    {
      n: '03',
      title: 'Hand out the desktop app',
      blurb:
        'One installer per teammate. From then on, hours, activity, and the end-of-day update happen automatically while they work.',
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-b border-border/60 py-14 sm:py-20"
    >
      {/* Soft atmosphere for the glass step cards */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[10%] top-10 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[15%] bottom-10 -z-10 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              Up and running in three steps.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-3 text-base text-muted-foreground">
              No sales calls and no onboarding projects. Provision a workspace
              and your team is productive within the hour.
            </p>
          </Reveal>
        </div>

        <ol className="relative mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {steps.map((s, i) => (
            <Reveal key={s.n} direction="up" delay={i * 100}>
              <li className="group relative h-full overflow-hidden rounded-2xl border border-white/55 bg-white/35 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_16px_40px_-24px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/75 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_56px_-24px_rgba(99,102,241,0.3)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-fuchsia-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <span
                  className="inline-block bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent"
                  style={{ backgroundSize: '200% 200%' }}
                >
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.blurb}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Pricing — Free / Pro / Enterprise
 * ──────────────────────────────────────────────────────────────────── */

interface PricingFeature {
  label: string
  /** Set true for items that are on the roadmap but not yet shipping.
   *  Renders a muted "soon" pill so we never over-promise. */
  soon?: boolean
}

interface PricingTier {
  name: string
  badge: string
  badgeTone: 'emerald' | 'primary' | 'fuchsia'
  price: string
  priceUnit: string | null
  /** Small line beneath the price, e.g. "billed annually" */
  priceFootnote: string | null
  description: string
  cta: { label: string; href: string; variant: 'primary' | 'ghost' }
  features: PricingFeature[]
  /** Adds a "carries everything from {name}" line above the feature list */
  inheritsFrom: string | null
  highlighted: boolean
}

function Pricing() {
  // Tier capacity and feature claims are sourced from
  // backend/src/contexts/org/domain/plans.py — keep them in sync. If a
  // capability is gated behind a feature flag that has no handler yet
  // (e.g. SSO, SCIM), mark it `soon: true` rather than dropping it.
  const tiers: PricingTier[] = [
    {
      name: 'Free',
      badge: 'Available now',
      badgeTone: 'emerald',
      price: '$0',
      priceUnit: '/ workspace',
      priceFootnote: 'No card required',
      description:
        'Enough room for a team of ten to plan work, track time, and ship — at no cost.',
      cta: { label: 'Start free', href: '/signup', variant: 'primary' },
      features: [
        { label: 'Up to 10 members and 3 projects' },
        { label: 'Unlimited tasks, comments, and reporting' },
        { label: 'Desktop apps for Windows, macOS, and Linux' },
        { label: 'Activity tracking for accurate time capture' },
        { label: '30-day audit-log retention' },
        { label: 'Community support' },
      ],
      inheritsFrom: null,
      highlighted: false,
    },
    {
      name: 'Pro',
      badge: 'Most popular',
      badgeTone: 'primary',
      price: '$8',
      priceUnit: '/ member / month',
      priceFootnote: 'Annual billing — coming soon',
      description:
        'For growing teams that want AI-assisted reporting, bigger seat counts, and the audit and admin controls customers ask about.',
      cta: {
        label: 'Notify me at launch',
        href: 'mailto:support@neurostack.in?subject=TaskFlow%20Pro%20launch%20notification',
        variant: 'primary',
      },
      features: [
        { label: 'Up to 50 members and 50 projects' },
        { label: 'AI daily summaries and weekly rollups' },
        { label: 'Periodic screenshot capture for time accuracy' },
        { label: 'Custom roles with per-permission editing' },
        { label: 'Custom workflow pipelines for your team' },
        { label: 'Project webhooks with HMAC-signed delivery' },
        { label: '365-day audit-log retention' },
        { label: 'Priority email support' },
        { label: 'Public REST API with personal access tokens', soon: true },
      ],
      inheritsFrom: 'Free',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      badge: 'Custom',
      badgeTone: 'fuchsia',
      price: 'Let’s talk',
      priceUnit: null,
      priceFootnote: 'Tailored to your scale and compliance needs',
      description:
        'For large organizations with security, data-residency, or compliance requirements that warrant a contract.',
      cta: {
        label: 'Contact sales',
        href: 'mailto:support@neurostack.in?subject=TaskFlow%20Enterprise%20enquiry',
        variant: 'ghost',
      },
      features: [
        { label: 'Unlimited members and projects' },
        { label: 'White-label branding (logo, colours, terminology)' },
        { label: 'Unlimited audit-log retention' },
        { label: 'Dedicated infrastructure on request' },
        { label: 'Named CSM and contractual SLA' },
        { label: 'Procurement, DPA, and security review support' },
        { label: 'Custom domain on your workspace', soon: true },
        { label: 'Single sign-on (SAML, OIDC)', soon: true },
        { label: 'SCIM provisioning and directory sync', soon: true },
      ],
      inheritsFrom: 'Pro',
      highlighted: false,
    },
  ]

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-14 sm:py-20"
    >
      {/* Layered background halo — the glass cards below refract this
          colour gradient, which is what makes the frosted surfaces read
          as genuinely glass instead of grey cards with a blur filter. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[10%] top-[20%] -z-10 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] bottom-[10%] -z-10 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-xl dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Pricing
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Pricing that grows with the team.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              Start free with the full product — no card, no demo call.
              Move to Pro when your team outgrows the seat cap. Talk to us
              about Enterprise when your procurement team gets involved.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch md:gap-5 lg:gap-6">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} direction="up" delay={240 + i * 80}>
              <PricingCard tier={tier} />
            </Reveal>
          ))}
        </div>

        <Reveal direction="up" delay={520}>
          <p className="mt-8 text-center text-[12px] text-muted-foreground">
            All tiers include AES-256 encryption at rest, TLS 1.2+ in
            transit, and full workspace export at any time.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function PricingCard({ tier }: { tier: PricingTier }) {
  // Tone palette per tier — keeps each card visually distinct without
  // breaking the shared glass aesthetic. Pro uses the brand primary so
  // it reads as the recommended path even before scanning the badge.
  const toneClasses = {
    emerald: {
      badge:
        'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      bar: 'from-emerald-400 via-emerald-500 to-teal-500',
      accent: 'text-emerald-500',
    },
    primary: {
      badge:
        'border-primary/40 bg-primary/15 text-primary',
      bar: 'from-primary via-accent to-fuchsia-500',
      accent: 'text-primary',
    },
    fuchsia: {
      badge:
        'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
      bar: 'from-fuchsia-500 via-purple-500 to-indigo-500',
      accent: 'text-fuchsia-500',
    },
  } as const

  const tone = toneClasses[tier.badgeTone]
  const isPrimaryCta = tier.cta.variant === 'primary'
  const isExternal = tier.cta.href.startsWith('mailto:') || tier.cta.href.startsWith('http')

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border backdrop-blur-2xl transition-all',
        tier.highlighted
          ? 'border-primary/40 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_30px_90px_-30px_rgba(99,102,241,0.6)] dark:border-primary/30 dark:bg-white/[0.05] md:-translate-y-2 md:scale-[1.02]'
          : 'border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_20px_60px_-30px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_60px_-30px_rgba(0,0,0,0.6)]'
      )}
    >
      {/* Top accent bar — gradient differs per tier so the three cards
          read as related but distinct. Highlighted tier gets the full
          brand gradient; the others get tone-matched bars. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          tone.bar
        )}
      />
      {tier.highlighted && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-fuchsia-400/20 opacity-60"
          style={{
            WebkitMask:
              'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
          }}
        />
      )}

      <div className="flex flex-1 flex-col p-7 lg:p-8">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            {tier.name}
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur',
              tone.badge
            )}
          >
            {tier.highlighted && <Sparkles className="h-2.5 w-2.5" />}
            {tier.badge}
          </span>
        </div>

        {/* ─── Price ─── */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-5xl font-black leading-none tracking-tighter text-transparent sm:text-6xl">
            {tier.price}
          </span>
          {tier.priceUnit && (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {tier.priceUnit}
            </span>
          )}
        </div>
        {tier.priceFootnote && (
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            {tier.priceFootnote}
          </p>
        )}

        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          {tier.description}
        </p>

        {/* ─── CTA ─── */}
        <div className="mt-6">
          {isPrimaryCta ? (
            <Link
              href={tier.cta.href}
              {...(isExternal ? { rel: 'noreferrer noopener' } : {})}
              className="group/cta relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_14px_28px_-10px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_18px_36px_-12px_rgba(99,102,241,0.8)]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/cta:translate-x-full"
              />
              <span className="relative">{tier.cta.label}</span>
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover/cta:translate-x-1" />
            </Link>
          ) : (
            <Link
              href={tier.cta.href}
              {...(isExternal ? { rel: 'noreferrer noopener' } : {})}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-white/60 px-5 py-3 text-sm font-bold text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-white/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]"
            >
              <span>{tier.cta.label}</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* ─── Features ─── */}
        <div className="mt-7 border-t border-border/40 pt-5">
          {tier.inheritsFrom && (
            <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/75">
              <Sparkles className={cn('h-3 w-3', tone.accent)} />
              Everything in {tier.inheritsFrom}, plus:
            </p>
          )}
          <ul className="space-y-2.5">
            {tier.features.map((item) => (
              <li
                key={item.label}
                className={cn(
                  'flex items-start gap-2.5 text-[13px] leading-snug',
                  item.soon ? 'text-foreground/55' : 'text-foreground/85'
                )}
              >
                <CheckCircle2
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    item.soon ? 'text-muted-foreground/50' : tone.accent
                  )}
                />
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span>{item.label}</span>
                  {item.soon && (
                    <span className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Soon
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * FAQ
 * ──────────────────────────────────────────────────────────────────── */

/* The Faq component lives in components/landing/Faq.tsx — interactive
 * (search + category filtering + smooth animated expand) so it needs
 * 'use client'. Kept out of this server-rendered file so the rest of
 * the landing page bundle stays lean. */

/* ────────────────────────────────────────────────────────────────────
 * Final CTA — big close-the-deal banner
 * ──────────────────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 py-14 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl animate-drift-slow"
      />
      {/* Single drift orb — replaces the two blur orbs + slow-spin
          concentric circles. The CTA section is meant to focus the
          eye, not perform a background animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal direction="up">
          <div className="mb-6 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <span aria-hidden className="h-px w-6 bg-primary/60" />
            Ready when you are
            <span aria-hidden className="h-px w-6 bg-primary/60" />
          </div>
        </Reveal>
        <Reveal direction="up" delay={80}>
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[44px] lg:text-[52px]">
            Run your team&apos;s next week on TaskFlow.
          </h2>
        </Reveal>
        <Reveal direction="up" delay={160}>
          <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Provision a workspace, invite your team, and deploy the desktop
            companion. Your first daily summary will be ready by tomorrow
            morning.
          </p>
        </Reveal>

        <Reveal direction="up" delay={240}>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Start free
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
            <Link
              href="/login"
              className="group inline-flex h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in to your workspace
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.8}
              />
            </Link>
          </div>
        </Reveal>

        <Reveal direction="up" delay={320}>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.8} />
              No card required
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.8} />
              Provisioned in under a minute
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.8} />
              Cancel anytime
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Footer
 * ──────────────────────────────────────────────────────────────────── */

function LandingFooter() {
  const columns: {
    title: string
    links: {
      label: string
      href: string
      external?: boolean
      isRoute?: boolean
    }[]
  }[] = [
    {
      title: 'Product',
      links: [
        { label: 'Why TaskFlow', href: '#problem' },
        { label: 'Capabilities', href: '#differentiator' },
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        {
          label: 'Desktop download',
          href: '/download',
          isRoute: true,
        },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Create workspace', href: '/signup', isRoute: true },
        { label: 'Sign in', href: '/login', isRoute: true },
        { label: 'Frequently asked', href: '#faq' },
      ],
    },
    {
      title: 'Company',
      links: [
        {
          label: 'Contact support',
          href: 'mailto:support@neurostack.in',
        },
        {
          label: 'NEUROSTACK',
          href: 'https://neurostack.in',
          external: true,
        },
      ],
    },
  ]

  const socials = [
    {
      label: 'Website',
      href: 'https://neurostack.in',
      Icon: Globe,
    },
    {
      label: 'Email support',
      href: 'mailto:support@neurostack.in',
      Icon: Mail,
    },
    {
      label: 'Product support',
      href: 'mailto:support@neurostack.in',
      Icon: MessageSquare,
    },
  ]

  const legal = [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
    { label: 'Status', href: '/status' },
  ]

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-gradient-to-b from-muted/40 via-muted/20 to-background">
      {/* Decorative top gradient line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      {/* Soft corner orb — adds depth without a hard shape */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        {/* Top grid — brand block takes the full two columns on md so the
            three link columns sit on the right half. */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-6 lg:gap-14">
          <div className="md:col-span-3 lg:col-span-3">
            <Logo size="md" hideSubline />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tasks, time tracking, daily updates, and time-off — in one
              app. Built for teams that bill by the hour, ship against
              deadlines, or owe a client an honest answer about how the
              week was spent.
            </p>

            {/* Availability strip — immediately communicates multi-platform */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Available on Web, Windows, macOS, and Linux
            </div>

            {/* Social row */}
            <ul className="mt-5 flex items-center gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target={s.href.startsWith('http') ? '_blank' : undefined}
                    rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    aria-label={s.label}
                    className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <s.Icon className="h-4 w-4" strokeWidth={1.8} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title} className="md:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => {
                  const className =
                    'group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none'
                  if (l.isRoute) {
                    return (
                      <li key={l.label}>
                        <Link href={l.href} className={className}>
                          {l.label}
                        </Link>
                      </li>
                    )
                  }
                  return (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        target={l.external ? '_blank' : undefined}
                        rel={l.external ? 'noopener noreferrer' : undefined}
                        className={className}
                      >
                        {l.label}
                        {l.external && (
                          <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} TaskFlow. All rights reserved.
          </p>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legal.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-1.5">
            Crafted by
            <a
              href="https://neurostack.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-foreground/80 transition-colors hover:text-primary"
            >
              NEUROSTACK
              <ArrowUpRight className="h-3 w-3 opacity-70" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
