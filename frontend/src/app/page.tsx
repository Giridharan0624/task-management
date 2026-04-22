import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  KanbanSquare,
  Layers,
  MessageSquare,
  Shuffle,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { MaybeRedirectIfAuthed } from '@/components/landing/MaybeRedirectIfAuthed'
import { Reveal } from '@/components/landing/Reveal'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'
import { HeroTaskMockup } from '@/components/landing/HeroTaskMockup'
import {
  ActivityWaveform,
  MouseSpotlight,
  TiltCard,
  TypewriterText,
} from '@/components/landing/interactions'
import { cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────
 * Page metadata + structured data
 * ──────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'TaskFlow — Tasks, time, and daily updates for small teams',
  description:
    'Plan work, track time, approve day-offs, and see what your team shipped today — all in one workspace. Free to start, works alongside a desktop companion app.',
  keywords: [
    'task management',
    'time tracking',
    'attendance',
    'daily standups',
    'small team',
    'project management',
    'SaaS',
  ],
  openGraph: {
    title: 'TaskFlow — Tasks, time, and daily updates for small teams',
    description:
      'One workspace for tasks, attendance, daily summaries, and day-offs. Free to start.',
    type: 'website',
    siteName: 'TaskFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskFlow — Tasks, time, and daily updates for small teams',
    description:
      'One workspace for tasks, attendance, daily summaries, and day-offs.',
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
    'Task management, time tracking, attendance, and daily updates for small teams.',
}

/* ────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
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
        className="flex-1 focus-visible:outline-none"
      >
        <Hero />
        <ProblemSection />
        <SolutionPillars />
        <Differentiator />
        <FeatureGrid />
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
 * Header
 * ──────────────────────────────────────────────────────────────────── */

function LandingHeader() {
  const navLinks = [
    { href: '#problem', label: 'Why TaskFlow' },
    { href: '#differentiator', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="md" hideSubline />
        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Start free
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Mobile anchor row — horizontally scrollable pill bar so section
          jumps stay reachable without a hamburger. */}
      <nav aria-label="Sections" className="border-t border-border/60 md:hidden">
        <ul className="-mb-px flex overflow-x-auto px-2 py-2 text-[11px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navLinks.map((l) => (
            <li key={l.href} className="shrink-0">
              <a
                href={l.href}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {l.label}
              </a>
            </li>
          ))}
          <li className="shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
          </li>
        </ul>
      </nav>
    </header>
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
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute left-[10%] top-[10%] h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-drift-slow"
            style={{ animationDelay: '-2s' }}
          />
          <div
            className="absolute right-[8%] top-[25%] h-64 w-64 rounded-full bg-accent/25 blur-3xl animate-drift-slower"
            style={{ animationDelay: '-6s' }}
          />
          <div
            className="absolute left-[40%] bottom-[10%] h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl animate-drift-slow"
            style={{ animationDelay: '-10s' }}
          />
          <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 animate-slow-spin">
            <div className="absolute inset-0 rounded-full border border-primary/10" />
            <div className="absolute inset-8 rounded-full border border-accent/10" />
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <Reveal direction="up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
                <Sparkles className="h-3 w-3 animate-pulse-soft" />
                One workspace per team
              </div>
            </Reveal>

            <Reveal direction="up" delay={80}>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Tasks, time, and daily updates{' '}
                <span
                  className="bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-transparent animate-gradient-shift"
                  style={{ backgroundSize: '200% 200%' }}
                >
                  in one place.
                </span>
              </h1>
            </Reveal>

            <Reveal direction="up" delay={160}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Plan work, track hours, approve day-offs, and see what your team
                shipped today — without juggling four tools. Free to start,
                ships with a desktop companion for real time-tracking.
              </p>
            </Reveal>

            <Reveal direction="up" delay={240}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
                >
                  Start free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
                >
                  Sign in
                </Link>
              </div>
            </Reveal>

            <Reveal direction="up" delay={320}>
              <p className="mt-6 text-xs text-muted-foreground">
                No credit card required · Set up your workspace in 60 seconds
              </p>
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
      title: 'Four tabs open, none of them talking.',
      blurb:
        'Task app here, timer there, leave requests in email, reports in a spreadsheet. Context switching eats more of the day than the work.',
      tone: 'text-rose-600 dark:text-rose-300',
      ring: 'ring-rose-500/20',
      bg: 'bg-rose-500/10',
    },
    {
      icon: MessageSquare,
      title: 'Chasing Slack for "what got done today?"',
      blurb:
        'Daily standups become a nightly search for context nobody will use again. Half the team forgot what they worked on at 11 AM.',
      tone: 'text-amber-600 dark:text-amber-300',
      ring: 'ring-amber-500/20',
      bg: 'bg-amber-500/10',
    },
    {
      icon: TrendingDown,
      title: 'Timesheets that reflect wishful thinking.',
      blurb:
        "Hours typed into a form vs. hours of actual focus. Admins can't tell them apart — until a billing dispute surfaces the gap.",
      tone: 'text-slate-600 dark:text-slate-300',
      ring: 'ring-slate-500/20',
      bg: 'bg-slate-500/10',
    },
  ]

  return (
    <section
      id="problem"
      className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-20 sm:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-rose-500/5 blur-3xl animate-drift-slow"
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
              Before TaskFlow
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Running a small team shouldn&apos;t feel like this.
            </h2>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.title} direction="up" delay={i * 80}>
              <li className="group relative h-full rounded-3xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg">
                <div
                  className={cn(
                    'mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset',
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
          <p className="mx-auto mt-14 max-w-2xl text-center text-lg font-semibold text-foreground/80">
            TaskFlow collapses the four into{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              one
            </span>
            .
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
      title: 'Track.',
      body: 'Timers, activity counters, screenshots. The desktop app does the heavy lifting so nobody has to log anything manually.',
      tint: 'from-primary/20 via-primary/5 to-transparent',
      iconTint: 'bg-primary/15 text-primary',
    },
    {
      icon: Brain,
      title: 'Know.',
      body: "AI-written daily updates. Who's in, who's out, which tasks are overdue — a dashboard that answers the question before you ask it.",
      tint: 'from-accent/20 via-accent/5 to-transparent',
      iconTint: 'bg-accent/15 text-accent',
    },
    {
      icon: BarChart3,
      title: 'Report.',
      body: 'Cross-project hours, per-member leaderboards, CSV exports, deep-linkable filters. Every slice of the week is a URL away.',
      tint: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
      iconTint: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
    },
  ]

  return (
    <section className="relative border-b border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One workspace.{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Three superpowers.
              </span>
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-4 text-base text-muted-foreground">
              Everything a small team needs to plan work, see what&apos;s
              happening, and prove it — without four subscriptions.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} direction="up" delay={i * 100}>
              <TiltCard maxTilt={4} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
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
                        'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/20 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6',
                        p.iconTint
                      )}
                    >
                      <p.icon className="h-7 w-7" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
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
      className="relative overflow-hidden border-b border-border/60 py-20 sm:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl animate-drift-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-accent/5 blur-3xl animate-drift-slower"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-20 max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" />
              What makes it different
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for teams that actually ship.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <p className="mt-4 text-base text-muted-foreground">
              Three capabilities that separate TaskFlow from the generic
              &ldquo;task tracker&rdquo; shelf.
            </p>
          </Reveal>
        </div>

        <div className="space-y-24 lg:space-y-32">
          {/* Row 1: Activity tracking */}
          <DemoRow
            badge="Live telemetry"
            badgeIcon={Activity}
            badgeColor="text-fuchsia-600 dark:text-fuchsia-300"
            title="Know when focus is real."
            blurb="The desktop companion watches keystroke and mouse-event counters — never contents — and reports them alongside your timer. Low activity for an hour? It shows up on the dashboard. High activity during a meeting block? Also caught."
            bullets={[
              'Per-session activity score, not vague "hours tracked"',
              'Runs in the background — no separate focus app',
              'Counters are numbers only. Zero keylogging.',
            ]}
            visual={<ActivityDemo />}
          />

          {/* Row 2: AI summaries */}
          <DemoRow
            reverse
            badge="Groq-powered"
            badgeIcon={Brain}
            badgeColor="text-purple-600 dark:text-purple-300"
            title="The daily update writes itself."
            blurb="An LLM reads the raw session log — tasks touched, hours per task, comments — and generates the end-of-day summary admins actually want to read. Nobody has to remember what they did at 11 AM anymore."
            bullets={[
              'Natural-language recap grouped by project',
              'Runs server-side at sign-out; frontend never holds the key',
              'Members can edit before it sends. Nothing is final until they confirm.',
            ]}
            visual={<AiDemo />}
          />

          {/* Row 3: Screenshots */}
          <DemoRow
            badge="Private by default"
            badgeIcon={Camera}
            badgeColor="text-blue-600 dark:text-blue-300"
            title="Proof, without micro-management."
            blurb="Every few minutes while a session is running, the desktop app captures a compressed screenshot and uploads it to your tenant's S3 prefix. Admins spot-check a day's work without interrupting the person doing it."
            bullets={[
              "Stored under your org prefix — zero cross-tenant access",
              'Compressed; a full day is under a few megabytes',
              'Captures pause instantly when the timer stops',
            ]}
            visual={<ScreenshotDemo />}
          />
        </div>
      </div>
    </section>
  )
}

interface DemoRowProps {
  badge: string
  badgeIcon: typeof Activity
  badgeColor: string
  title: string
  blurb: string
  bullets: string[]
  visual: React.ReactNode
  reverse?: boolean
}

function DemoRow({
  badge,
  badgeIcon: BadgeIcon,
  badgeColor,
  title,
  blurb,
  bullets,
  visual,
  reverse,
}: DemoRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16',
        reverse && 'lg:grid-flow-dense'
      )}
    >
      <div className={cn(reverse && 'lg:col-start-2')}>
        <Reveal direction={reverse ? 'right' : 'left'}>
          <div
            className={cn(
              'mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur',
              badgeColor
            )}
          >
            <BadgeIcon className="h-3 w-3" />
            {badge}
          </div>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={80}>
          <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h3>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={160}>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {blurb}
          </p>
        </Reveal>
        <Reveal direction={reverse ? 'right' : 'left'} delay={240}>
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-sm text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal
        direction={reverse ? 'left' : 'right'}
        delay={120}
        className={cn(reverse && 'lg:col-start-1 lg:row-start-1')}
      >
        <TiltCard maxTilt={4}>{visual}</TiltCard>
      </Reveal>
    </div>
  )
}

function DemoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevated">
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-20 -z-10 rounded-[40px] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-3xl animate-drift-slow"
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
            <AnimatedCounter to={87} suffix="%" /> focus
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
            Generated summary · Apr 21
          </p>
        </div>
        <TypewriterText
          className="text-[13px] text-foreground/90"
          speed={18}
          linePause={160}
          lines={[
            '> Analyzing 3 sessions across 2 projects…',
            '',
            '✓ Payments · Stripe Connect onboarding (2h 9m)',
            '  — Shipped the branching onboarding form, wired',
            '    KYC redirect, left error handling for PR.',
            '',
            '✓ Marketing · Refresh hero imagery (1h 53m)',
            '  — 3 draft variants; picking tomorrow with @priya.',
            '',
            'Total focus · 87%   Screenshots · 42   Submitted ✓',
          ]}
        />
      </div>
    </DemoFrame>
  )
}

function ScreenshotDemo() {
  return (
    <DemoFrame>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Captured this session
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-blue-600 dark:text-blue-300">
              <AnimatedCounter to={42} />
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            Tenant S3 only
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 py-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-border/80 bg-gradient-to-br from-primary/30 to-accent/20 shadow-sm"
              style={{
                transform: `rotate(${(i - 2.5) * 3}deg) translateY(${Math.abs(i - 2.5) * 3}px)`,
                zIndex: 10 - Math.abs(i - 2.5),
              }}
            >
              <div className="grid h-full grid-cols-5 gap-0.5 p-1.5 opacity-70">
                {Array.from({ length: 15 }).map((_, k) => (
                  <span
                    key={k}
                    className="rounded-[2px]"
                    style={{
                      backgroundColor: `hsl(${(i * 57 + k * 23) % 360}, 65%, 74%)`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Feature grid — everything else, uniform compact cards
 * ──────────────────────────────────────────────────────────────────── */

interface FeatureCardData {
  icon: typeof KanbanSquare
  title: string
  blurb: string
  tint: string
  iconClass: string
}

const FEATURES: FeatureCardData[] = [
  {
    icon: KanbanSquare,
    title: 'Projects & Kanban',
    blurb:
      'List, board, group by priority or deadline. Bulk-assign, bulk-mark-done, save filter presets.',
    tint: 'from-indigo-500/15',
    iconClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  },
  {
    icon: Clock,
    title: 'Time tracking',
    blurb:
      'Clock in from web or desktop. Cross-project reports, CSV exports, per-member leaderboards.',
    tint: 'from-emerald-500/15',
    iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  {
    icon: FileText,
    title: 'Daily updates',
    blurb:
      'Submitted, missing, overdue — all in one view. Copy emails for a nudge, spot the week at a glance.',
    tint: 'from-amber-500/15',
    iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  {
    icon: Calendar,
    title: 'Day-off requests',
    blurb:
      'Past dates blocked, duplicates rejected, auto-approver picked. One-click approve.',
    tint: 'from-rose-500/15',
    iconClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
  {
    icon: Layers,
    title: 'Custom pipelines',
    blurb:
      'Design your own task workflow — different stages per project domain, each with its own colors.',
    tint: 'from-teal-500/15',
    iconClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-300',
  },
  {
    icon: Users,
    title: 'Per-tenant workspaces',
    blurb:
      'Workspace-code isolation. Terminology, feature toggles, branding, locale. No cross-tenant leakage.',
    tint: 'from-violet-500/15',
    iconClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  },
  {
    icon: ShieldCheck,
    title: 'Owned by you',
    blurb:
      'CSV exports everywhere. Three-tier roles. SRP auth — passwords never leave the browser.',
    tint: 'from-cyan-500/15',
    iconClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
  },
  {
    icon: BarChart3,
    title: 'Cross-project reports',
    blurb:
      'Hours by project, by member, by week. Deep-link any filter — saved views survive a reload or share.',
    tint: 'from-orange-500/15',
    iconClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  },
  {
    icon: Download,
    title: 'Signed desktop installers',
    blurb:
      'Native apps for Windows, macOS, Linux. Auto-updater, offline resilience. Not a browser tab.',
    tint: 'from-lime-500/15',
    iconClass: 'bg-lime-500/15 text-lime-600 dark:text-lime-300',
  },
]

function FeatureGrid() {
  return (
    <section
      className="relative overflow-hidden border-b border-border/60 py-20 sm:py-28"
      style={{
        background:
          'linear-gradient(180deg, rgba(99,102,241,0.03) 0%, transparent 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(rgb(var(--color-primary) / 0.2) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Plus everything you&apos;d expect.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-4 text-base text-muted-foreground">
              The toolkit that usually costs four SaaS subscriptions, shipped as
              one.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} direction="up" delay={i * 40}>
              <li className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-border hover:shadow-xl">
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br via-background to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100',
                    f.tint
                  )}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all duration-500 group-hover:bg-primary/20"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
                />

                <div className="relative flex h-full flex-col">
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
 * How it works
 * ──────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Create your workspace',
      blurb:
        'Pick a workspace code (what teammates use to sign in). Customize colors and terminology to match your team.',
    },
    {
      n: '02',
      title: 'Invite your team',
      blurb:
        'Send invites by email. They choose a password, land on their dashboard. Role-based access decides what they see.',
    },
    {
      n: '03',
      title: 'Install the desktop app',
      blurb:
        'The timer lives there. It counts activity, snaps occasional screenshots, and submits end-of-day summaries automatically.',
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-b border-border/60 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Get running in three steps.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-4 text-base text-muted-foreground">
              No demo calls, no sales funnel. Sign up and you&apos;re productive
              inside an hour.
            </p>
          </Reveal>
        </div>

        <ol className="relative mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {steps.map((s, i) => (
            <Reveal key={s.n} direction="up" delay={i * 100}>
              <li className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
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
 * Pricing — Free forever
 * ──────────────────────────────────────────────────────────────────── */

function Pricing() {
  const includes = [
    'Unlimited workspaces',
    'Unlimited members',
    'Unlimited projects & tasks',
    'AI daily summaries (Groq-powered)',
    'Activity tracking + screenshot evidence',
    'Cross-project reports + CSV exports',
    'Desktop app (Windows, macOS, Linux)',
    'SRP authentication + role-based permissions',
  ]

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-20 sm:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl animate-drift-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-10 h-[460px] w-[460px] rounded-full bg-accent/10 blur-3xl animate-drift-slower"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal direction="up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Pricing
            </div>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Free for every team.{' '}
              <span className="bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-transparent">
                Forever.
              </span>
            </h2>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              No seat limits. No feature tiers. The desktop app, the AI
              summaries, the reports — all included. Paid tiers will exist one
              day for larger teams and compliance add-ons; existing workspaces
              stay on Free.
            </p>
          </Reveal>
        </div>

        <Reveal direction="up" delay={240}>
          <TiltCard maxTilt={3}>
            <div className="relative mt-14 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevated">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-fuchsia-500"
              />
              <div className="grid grid-cols-1 gap-8 p-8 sm:p-12 md:grid-cols-[1fr_auto] md:gap-12">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    The Free plan
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-6xl font-black tracking-tighter text-foreground">
                      $0
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / workspace / forever
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Everything in TaskFlow is in the box. No credit card at
                    signup, no feature-gated upsell banners inside the app.
                  </p>

                  <ul className="mt-6 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                    {includes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-foreground/90"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col items-stretch justify-center gap-3 md:items-end md:justify-end">
                  <Link
                    href="/signup"
                    className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Start free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <p className="text-center text-[11px] text-muted-foreground md:text-right">
                    60-second setup · No card required
                  </p>
                </div>
              </div>
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * FAQ
 * ──────────────────────────────────────────────────────────────────── */

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is TaskFlow really free?',
    a: 'The workspace, invites, projects, tasks, reports, and the desktop app are all free. We plan paid tiers for larger teams and compliance features down the road — existing workspaces stay on the free tier.',
  },
  {
    q: 'Can I host TaskFlow on my own infrastructure?',
    a: "Self-hosting isn't officially supported yet. The backend is Python Lambda + DynamoDB on AWS CDK — the infra is open enough that a technical team could bring their own AWS account, but we don't provide a one-click self-host installer at the moment.",
  },
  {
    q: 'Do I own my data? Can I export it?',
    a: 'Yes. Every list view has a CSV export. A full-workspace export (users, projects, tasks, attendance, day-offs in JSON + CSV) is on the roadmap.',
  },
  {
    q: 'How is my team isolated from other tenants?',
    a: 'Every database key is prefixed with your org id. Every authenticated request re-reads your role from DynamoDB (not just the JWT claim). Uploads live under your org prefix in S3 and the presigned-URL handler refuses any key outside it.',
  },
  {
    q: 'Does TaskFlow support multiple teams in one workspace?',
    a: 'One workspace = one team. Inside it you can have any number of projects with their own members and roles. If you run several businesses, create a workspace per business — data stays isolated.',
  },
  {
    q: 'What happens when I sign out of the desktop app?',
    a: 'Your running session closes at sign-out. Hours are attributed to the day you clocked in. If you force-kill the app, a nightly sweeper closes any orphaned sessions so your timesheet stays clean.',
  },
]

function Faq() {
  return (
    <section
      id="faq"
      className="relative overflow-hidden border-b border-border/60 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <Reveal direction="up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Questions, answered.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-3 text-sm text-muted-foreground">
              Can&apos;t find what you need? Email us at{' '}
              <a
                href="mailto:support@neurostack.in"
                className="font-semibold text-primary hover:underline"
              >
                support@neurostack.in
              </a>
              .
            </p>
          </Reveal>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, i) => (
            <Reveal key={item.q} direction="up" delay={i * 40}>
              <details className="group rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary opacity-50 transition-opacity group-open:opacity-100" />
                    {item.q}
                  </span>
                  <span className="text-lg font-light text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Final CTA — big close-the-deal banner
 * ──────────────────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl animate-drift-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-accent/20 blur-3xl animate-drift-slower"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 animate-slow-spin opacity-40"
      >
        <div className="absolute inset-0 rounded-full border border-primary/15" />
        <div className="absolute inset-10 rounded-full border border-accent/15" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal direction="up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
            <Sparkles className="h-3 w-3 animate-pulse-soft" />
            Ready when you are
          </div>
        </Reveal>
        <Reveal direction="up" delay={80}>
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your team&apos;s next week{' '}
            <span
              className="bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-transparent animate-gradient-shift"
              style={{ backgroundSize: '200% 200%' }}
            >
              runs here.
            </span>
          </h2>
        </Reveal>
        <Reveal direction="up" delay={160}>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Create a workspace, invite your team, install the desktop app.
            You&apos;ll see the first daily update by tomorrow morning.
          </p>
        </Reveal>

        <Reveal direction="up" delay={240}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              Start free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-6 py-4 text-base font-semibold text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </Reveal>

        <Reveal direction="up" delay={320}>
          <p className="mt-6 text-xs text-muted-foreground">
            No credit card required · Set up in 60 seconds · Cancel the moment
            you want
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Footer
 * ──────────────────────────────────────────────────────────────────── */

function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-muted/30 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" hideSubline />
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              One workspace for tasks, time, daily updates, and day-offs. Built
              for small teams.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="#problem"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Why TaskFlow
                </a>
              </li>
              <li>
                <a
                  href="#differentiator"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Giridharan0624/taskflow-desktop/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Desktop download
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Account
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/signup"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Start free
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Company
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:support@neurostack.in"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-[11px] text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
          <p>
            Built by{' '}
            <span className="font-semibold text-foreground/70">NEUROSTACK</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
