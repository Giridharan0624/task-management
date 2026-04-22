import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

interface LegalShellProps {
  badge: string
  title: string
  /** "Last updated: ..." or similar subtitle line. Rendered under the title. */
  updated?: string
  lead?: React.ReactNode
  /** Optional right-column sidebar — e.g., a table of contents. */
  aside?: React.ReactNode
  children: React.ReactNode
}

export function LegalShell({
  badge,
  title,
  updated,
  lead,
  aside,
  children,
}: LegalShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LegalHeader />

      {/* Hero band — lighter than landing's, but still gives the page its
          own identity so visitors know they've moved into a different
          category of content. */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/[0.04] via-background to-background">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[10%] top-[10%] h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-[10%] top-[25%] h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            {badge}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {updated && (
            <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
          )}
          {lead && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {lead}
            </p>
          )}
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div
            className={cn(
              'grid grid-cols-1 gap-10',
              aside && 'lg:grid-cols-[0.3fr_0.7fr] lg:gap-14'
            )}
          >
            {aside && (
              <aside className="lg:sticky lg:top-24 lg:self-start">
                {aside}
              </aside>
            )}
            <article className="legal-content max-w-3xl">{children}</article>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  )
}

function LegalHeader() {
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

function LegalFooter() {
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
          <Link
            href="/security"
            className="transition-colors hover:text-foreground"
          >
            Security
          </Link>
          <Link href="/status" className="transition-colors hover:text-foreground">
            Status
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

interface SectionProps {
  id: string
  title: string
  children: React.ReactNode
}

export function LegalSection({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/60 py-10 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  )
}

interface TocProps {
  items: { id: string; label: string }[]
}

export function LegalToc({ items }: TocProps) {
  return (
    <nav aria-label="Table of contents">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        On this page
      </p>
      <ol className="mt-4 space-y-1.5">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="group flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="mt-0.5 inline-block w-5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70 group-hover:text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface ContactCardProps {
  title?: string
  body?: string
  email?: string
}

export function LegalContactCard({
  title = 'Questions about this page?',
  body = 'Reach out to our team and we will respond within one business day.',
  email = 'support@neurostack.in',
}: ContactCardProps) {
  return (
    <div className="mt-10 rounded-3xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <a
        href={`mailto:${email}`}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {email}
      </a>
    </div>
  )
}
