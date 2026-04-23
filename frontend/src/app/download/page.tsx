import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  FileDown,
  HardDrive,
  Laptop,
  Monitor,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wifi,
} from 'lucide-react'

import { Logo } from '@/components/ui/Logo'
import { Reveal } from '@/components/landing/Reveal'
import { cn } from '@/lib/utils'

const RELEASES_URL =
  'https://github.com/Giridharan0624/taskflow-desktop/releases/latest'

export const metadata: Metadata = {
  title: 'Download TaskFlow Desktop — Native apps for Windows, macOS, and Linux',
  description:
    'Install the TaskFlow desktop companion for accurate time tracking, automatic activity capture, and AI-generated daily summaries. Native builds for Windows, macOS, and Linux.',
  openGraph: {
    title: 'Download TaskFlow Desktop',
    description:
      'Native desktop applications for Windows, macOS, and Linux. Automatic time tracking, activity capture, and daily reporting.',
    type: 'website',
    siteName: 'TaskFlow',
  },
}

/* ────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────── */

export default function DownloadPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <DownloadHeader />
      <main className="flex-1">
        <Hero />
        <PlatformGrid />
        <Capabilities />
        <InstallSteps />
        <SecondaryInfo />
      </main>
      <DownloadFooter />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Header — minimal, distinct from landing
 * ──────────────────────────────────────────────────────────────────── */

function DownloadHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo size="md" hideSubline />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/signup"
            className="hidden rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
          >
            Create workspace
          </Link>
        </nav>
      </div>
    </header>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Hero
 * ──────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[10%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[10%] top-[25%] h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(var(--color-primary)) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
        <Reveal direction="up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Desktop companion
          </div>
        </Reveal>

        <Reveal direction="up" delay={80}>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Install TaskFlow{' '}
            <span
              className="bg-gradient-to-r from-primary via-accent to-fuchsia-500 bg-clip-text text-transparent"
              style={{ backgroundSize: '200% 200%' }}
            >
              Desktop.
            </span>
          </h1>
        </Reveal>

        <Reveal direction="up" delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A native desktop application for accurate time tracking, automatic
            activity capture, and AI-generated daily summaries. Signed installers
            are available for Windows, macOS, and Linux.
          </p>
        </Reveal>

        <Reveal direction="up" delay={240}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Code-signed installers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wifi className="h-4 w-4 text-primary" />
              Offline resilient
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Download className="h-4 w-4 text-accent" />
              Automatic updates
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Platform selector grid
 * ──────────────────────────────────────────────────────────────────── */

interface PlatformAlt {
  /** Small secondary download on the same card — e.g. AppImage on Linux. */
  label: string
  href: string
  assetLabel: string
}

interface Platform {
  name: string
  tagline: string
  Icon: typeof Monitor
  version: string
  format: string
  href: string
  assetLabel: string
  tint: string
  iconTint: string
  ring: string
  alt?: PlatformAlt
}

const PLATFORMS: Platform[] = [
  {
    name: 'Windows',
    tagline: 'Windows 10 and later',
    Icon: Monitor,
    version: '64-bit',
    format: '.exe installer',
    href: '/api/download/windows',
    assetLabel: 'TaskFlowDesktop-Setup.exe',
    tint: 'from-sky-500/15 to-blue-500/5',
    iconTint: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-500/20',
  },
  {
    name: 'macOS',
    tagline: 'macOS 12 Monterey and later',
    Icon: Apple,
    version: 'Universal · Apple Silicon + Intel',
    format: '.dmg disk image',
    href: '/api/download/macos',
    assetLabel: 'TaskFlowDesktop-universal.dmg',
    tint: 'from-slate-500/15 to-zinc-500/5',
    iconTint: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-500/20',
  },
  {
    name: 'Linux',
    tagline: 'Ubuntu 24.04+ · Debian 13+',
    Icon: Terminal,
    version: 'x86_64',
    format: '.deb package',
    href: '/api/download/linux?format=deb',
    assetLabel: 'taskflow-desktop_amd64.deb',
    tint: 'from-amber-500/15 to-orange-500/5',
    iconTint: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    ring: 'ring-amber-500/20',
    alt: {
      label: 'Other distro? Download AppImage',
      href: '/api/download/linux?format=appimage',
      assetLabel: 'TaskFlow-x86_64.AppImage',
    },
  },
]

function PlatformGrid() {
  return (
    <section className="relative border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Choose your platform
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-2 text-sm text-muted-foreground">
              Each installer is less than 60&nbsp;MB and updates automatically
              once installed.
            </p>
          </Reveal>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLATFORMS.map((p, i) => (
            <Reveal key={p.name} direction="up" delay={i * 80}>
              <li className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-border hover:shadow-xl">
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity duration-500 group-hover:opacity-100',
                    p.tint
                  )}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
                />

                <div className="relative flex h-full flex-col">
                  <div
                    className={cn(
                      'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset shadow-sm transition-transform duration-300 group-hover:scale-110',
                      p.iconTint,
                      p.ring
                    )}
                  >
                    <p.Icon className="h-7 w-7" strokeWidth={1.6} />
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.tagline}
                  </p>

                  <dl className="mt-5 space-y-2 border-t border-border/50 pt-4 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Cpu className="h-3.5 w-3.5" />
                        Architecture
                      </dt>
                      <dd className="text-right font-semibold text-foreground">
                        {p.version}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <FileDown className="h-3.5 w-3.5" />
                        Format
                      </dt>
                      <dd className="text-right font-semibold text-foreground">
                        {p.format}
                      </dd>
                    </div>
                  </dl>

                  <a
                    href={p.href}
                    download
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Download className="h-4 w-4" />
                    Download for {p.name}
                  </a>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Latest release · {p.assetLabel}
                  </p>

                  {p.alt && (
                    <a
                      href={p.alt.href}
                      download
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Download className="h-3 w-3" />
                      {p.alt.label}
                    </a>
                  )}
                </div>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal direction="up" delay={320}>
          <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted-foreground">
            Looking for an older version or a specific asset? Browse{' '}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              all releases on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Capabilities
 * ──────────────────────────────────────────────────────────────────── */

function Capabilities() {
  // Per-card colour identity — keeps the grid monochrome at rest, but
  // each card brightens to its own accent on hover. Borrowed pattern
  // from the landing page's compliance + capability sections.
  const items = [
    {
      Icon: Clock,
      title: 'Accurate session timer',
      blurb:
        'Start and stop sessions from the system tray. Time is attributed to the workspace and project you select.',
      tint: 'from-indigo-500/10 via-indigo-500/5',
      iconTint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
      ring: 'ring-indigo-500/20',
      glow: 'group-hover:bg-indigo-500/15',
      bar: 'from-indigo-500 via-indigo-400 to-indigo-300',
    },
    {
      Icon: HardDrive,
      title: 'Aggregate activity capture',
      blurb:
        'Keystroke and mouse-event counters record frequency only — never content. A low-activity period surfaces automatically.',
      tint: 'from-fuchsia-500/10 via-fuchsia-500/5',
      iconTint: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300',
      ring: 'ring-fuchsia-500/20',
      glow: 'group-hover:bg-fuchsia-500/15',
      bar: 'from-fuchsia-500 via-pink-400 to-rose-400',
    },
    {
      Icon: Camera,
      title: 'Periodic screenshot evidence',
      blurb:
        'Compressed screenshots upload to your organization’s S3 prefix at regular intervals for lightweight spot checks.',
      tint: 'from-sky-500/10 via-sky-500/5',
      iconTint: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
      ring: 'ring-sky-500/20',
      glow: 'group-hover:bg-sky-500/15',
      bar: 'from-sky-500 via-cyan-400 to-blue-400',
    },
    {
      Icon: Brain,
      title: 'Automatic daily summaries',
      blurb:
        'At sign-out the desktop application submits a structured session log that TaskFlow converts into an AI-written recap.',
      tint: 'from-violet-500/10 via-violet-500/5',
      iconTint: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
      ring: 'ring-violet-500/20',
      glow: 'group-hover:bg-violet-500/15',
      bar: 'from-violet-500 via-purple-400 to-fuchsia-400',
    },
    {
      Icon: Wifi,
      title: 'Offline resilience',
      blurb:
        'Sessions continue locally during network loss and sync back to the cloud as soon as connectivity is restored.',
      tint: 'from-emerald-500/10 via-emerald-500/5',
      iconTint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      ring: 'ring-emerald-500/20',
      glow: 'group-hover:bg-emerald-500/15',
      bar: 'from-emerald-500 via-teal-400 to-cyan-400',
    },
    {
      Icon: ShieldCheck,
      title: 'Tenant-scoped storage',
      blurb:
        'All uploads are written under your organization prefix. Cross-tenant access is architecturally prevented at the presign layer.',
      tint: 'from-amber-500/10 via-amber-500/5',
      iconTint: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
      ring: 'ring-amber-500/20',
      glow: 'group-hover:bg-amber-500/15',
      bar: 'from-amber-500 via-orange-400 to-rose-400',
    },
  ]

  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-16 sm:py-24">
      {/* Soft positional washes to break up the flat muted strip */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-10 -z-10 h-72 w-72 rounded-full bg-accent/5 blur-3xl"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Reveal direction="up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              Capabilities
            </p>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What the desktop application delivers
            </h2>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              The capabilities that distinguish TaskFlow from generic task
              trackers all run in the native desktop companion.
            </p>
          </Reveal>
        </div>

        {/* Pixel-grid mosaic: shared 1px dividers via gap-px on a bordered
            parent — gives the section the enterprise-mosaic feel without
            a halo on every card. */}
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} direction="up" delay={i * 70}>
              <li
                className={cn(
                  'group relative flex h-full flex-col overflow-hidden bg-card p-6 transition-all duration-300',
                  'hover:-translate-y-0.5 hover:shadow-lg sm:p-7'
                )}
              >
                {/* Top-edge gradient bar — invisible at rest, slides in on hover */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    item.bar
                  )}
                />
                {/* Tinted background wash that fades in on hover */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100',
                    item.tint
                  )}
                />
                {/* Soft corner orb that brightens on hover */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-transparent blur-3xl transition-colors duration-500',
                    item.glow
                  )}
                />

                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm transition-all duration-300 group-hover:rotate-6 group-hover:scale-110',
                      item.iconTint,
                      item.ring
                    )}
                  >
                    <item.Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="relative mt-5 text-base font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="relative mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {item.blurb}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Install steps
 * ──────────────────────────────────────────────────────────────────── */

function InstallSteps() {
  const steps = [
    {
      n: '01',
      title: 'Download the installer',
      blurb:
        'Select your operating system above. The latest signed release downloads directly from GitHub.',
    },
    {
      n: '02',
      title: 'Run the installer',
      blurb:
        'Launch the downloaded file and follow the platform-native installation prompts. No administrator intervention is required on most systems.',
    },
    {
      n: '03',
      title: 'Sign in to your workspace',
      blurb:
        'Enter your workspace code, email, and password. The application signs you in using the same Secure Remote Password protocol as the web experience.',
    },
  ]

  return (
    <section className="relative border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Reveal direction="up">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Installation in three steps
            </h2>
          </Reveal>
          <Reveal direction="up" delay={80}>
            <p className="mt-2 text-sm text-muted-foreground">
              Typical setup completes in under two minutes.
            </p>
          </Reveal>
        </div>

        <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
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
                <h3 className="mt-3 text-base font-semibold text-foreground">
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
 * Secondary — system requirements + no-workspace CTA
 * ──────────────────────────────────────────────────────────────────── */

function SecondaryInfo() {
  const requirements = [
    {
      name: 'Operating system',
      windows: 'Windows 10 (64-bit) or later',
      mac: 'macOS 12 Monterey or later',
      linux: 'glibc 2.31 or later (Ubuntu 20.04+, Fedora 33+)',
    },
    {
      name: 'Memory',
      windows: '2 GB RAM',
      mac: '2 GB RAM',
      linux: '2 GB RAM',
    },
    {
      name: 'Disk space',
      windows: '120 MB',
      mac: '140 MB',
      linux: '110 MB',
    },
    {
      name: 'Network',
      windows: 'TLS 1.3 outbound',
      mac: 'TLS 1.3 outbound',
      linux: 'TLS 1.3 outbound',
    },
  ]

  return (
    <section className="relative border-b border-border/60 bg-muted/20 py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:px-8">
        {/* System requirements */}
        <Reveal direction="up">
          <div className="h-full rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <Laptop className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  System requirements
                </h2>
                <p className="text-xs text-muted-foreground">
                  Minimum hardware and software needed to run TaskFlow Desktop.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="px-3 py-2">Windows</th>
                    <th className="px-3 py-2">macOS</th>
                    <th className="py-2 pl-3">Linux</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r, i) => (
                    <tr
                      key={r.name}
                      className={cn(
                        'text-sm',
                        i < requirements.length - 1 &&
                          'border-b border-border/30'
                      )}
                    >
                      <td className="py-3 pr-3 font-semibold text-foreground">
                        {r.name}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {r.windows}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {r.mac}
                      </td>
                      <td className="py-3 pl-3 text-muted-foreground">
                        {r.linux}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* No workspace CTA */}
        <Reveal direction="up" delay={120}>
          <div className="h-full overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" />
              No workspace yet?
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              The desktop application needs a workspace to sign in to.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Provisioning is free and takes under a minute. Create your
              workspace first, then install the desktop companion for automatic
              time tracking and daily reporting.
            </p>

            <ul className="mt-5 space-y-2 text-sm">
              {[
                'Free for every team, permanently',
                'No credit card at signup',
                'Same account works on web and desktop',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Create workspace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Footer — compact
 * ──────────────────────────────────────────────────────────────────── */

function DownloadFooter() {
  return (
    <footer className="relative overflow-hidden bg-muted/30 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Logo size="sm" hideSubline />
          <span>© {new Date().getFullYear()} TaskFlow</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/"
            className="transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            Release notes
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="mailto:support@neurostack.in"
            className="transition-colors hover:text-foreground"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  )
}
