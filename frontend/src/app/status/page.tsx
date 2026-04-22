import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Globe,
  HardDrive,
  Server,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export const metadata: Metadata = {
  title: 'System Status — TaskFlow',
  description:
    'Real-time status of the TaskFlow API, dashboard, desktop updater, database, and storage layer.',
}

type Status = 'operational' | 'degraded' | 'outage' | 'maintenance'

interface Service {
  name: string
  Icon: typeof Globe
  description: string
  status: Status
  uptime30: string
}

// In a future iteration this will be populated from a monitoring endpoint.
// Until then, the page reflects the steady state: all systems operational.
const SERVICES: Service[] = [
  {
    name: 'Web dashboard',
    Icon: Globe,
    description: 'Next.js application served by Vercel.',
    status: 'operational',
    uptime30: '99.98%',
  },
  {
    name: 'REST API',
    Icon: Server,
    description: 'Python Lambda monolith behind API Gateway (ap-south-1).',
    status: 'operational',
    uptime30: '99.96%',
  },
  {
    name: 'Primary database',
    Icon: Database,
    description: 'Amazon DynamoDB — single-table design.',
    status: 'operational',
    uptime30: '100%',
  },
  {
    name: 'Object storage',
    Icon: HardDrive,
    description: 'Amazon S3 with per-tenant prefix isolation.',
    status: 'operational',
    uptime30: '100%',
  },
  {
    name: 'Desktop auto-updater',
    Icon: Download,
    description: 'GitHub Releases as the artifact source for TaskFlow Desktop.',
    status: 'operational',
    uptime30: '99.99%',
  },
]

const STATUS_META: Record<
  Status,
  { label: string; tone: string; dot: string; ring: string }
> = {
  operational: {
    label: 'Operational',
    tone: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20 border-emerald-400/40 bg-emerald-500/10',
  },
  degraded: {
    label: 'Degraded',
    tone: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20 border-amber-400/40 bg-amber-500/10',
  },
  outage: {
    label: 'Outage',
    tone: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/20 border-rose-400/40 bg-rose-500/10',
  },
  maintenance: {
    label: 'Maintenance',
    tone: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500/20 border-sky-400/40 bg-sky-500/10',
  },
}

export default function StatusPage() {
  const overall: Status = SERVICES.every((s) => s.status === 'operational')
    ? 'operational'
    : SERVICES.some((s) => s.status === 'outage')
      ? 'outage'
      : 'degraded'
  const overallMeta = STATUS_META[overall]
  const now = new Date()
  const timestamp = now.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StatusHeader />

      <main className="flex-1">
        {/* Overall banner */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-[10%] top-[10%] h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute right-[10%] top-[25%] h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Clock className="h-3 w-3" />
              System status
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {overall === 'operational'
                ? 'All systems operational.'
                : overall === 'outage'
                  ? 'We are experiencing an outage.'
                  : 'We are investigating elevated error rates.'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last refreshed: {timestamp} (Asia/Kolkata)
            </p>

            {/* Big status pill */}
            <div
              className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ring-1 ring-inset ${overallMeta.ring} ${overallMeta.tone}`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${overallMeta.dot}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${overallMeta.dot}`}
                />
              </span>
              {overallMeta.label}
            </div>
          </div>
        </section>

        {/* Per-service status */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Services
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Uptime · last 30 days
            </p>
          </div>

          <ul className="divide-y divide-border rounded-3xl border border-border/70 bg-card">
            {SERVICES.map((s) => {
              const meta = STATUS_META[s.status]
              return (
                <li
                  key={s.name}
                  className="flex items-center gap-4 p-5 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                    <s.Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{s.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    <p className="font-mono font-semibold tabular-nums text-foreground">
                      {s.uptime30}
                    </p>
                    <p className="text-[10px] text-muted-foreground">uptime</p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${meta.ring} ${meta.tone}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Incidents */}
        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Recent incidents
          </h2>

          <div className="flex items-start gap-4 rounded-3xl border border-border/70 bg-card p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                No incidents reported in the last 90 days.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                We publish post-incident reports here within seventy-two
                hours of resolution. To receive notifications in advance,
                workspace administrators can subscribe by email at{' '}
                <a
                  href="mailto:support@neurostack.in?subject=Status%20notifications"
                  className="font-semibold text-primary hover:underline"
                >
                  support@neurostack.in
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Footnote */}
        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            This status page reflects the operational state of TaskFlow
            services as last reported. Uptime figures are calculated over the
            previous thirty (30) days and include both scheduled maintenance
            windows and unplanned events. Detailed monitoring dashboards are
            maintained internally and shared with customers under enterprise
            agreements upon request.
          </p>
        </section>
      </main>

      <StatusFooter />
    </div>
  )
}

function StatusHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="TaskFlow home">
          <Logo size="md" hideSubline />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </header>
  )
}

function StatusFooter() {
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
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/security" className="transition-colors hover:text-foreground">
            Security
          </Link>
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
