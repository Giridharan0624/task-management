'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Download } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

interface NavLink {
  /** Section id for in-page anchors, or an absolute route path. */
  href: string
  label: string
  /** When true, treat as an external/route link (use Next Link, no active
   *  tracking). */
  isRoute?: boolean
}

const NAV_LINKS: NavLink[] = [
  { href: '#problem', label: 'Why TaskFlow' },
  { href: '#differentiator', label: 'Capabilities' },
  { href: '#features', label: 'Features' },
  { href: '#desktop', label: 'Desktop' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

const ANCHOR_IDS = NAV_LINKS.filter((l) => !l.isRoute).map((l) =>
  l.href.replace('#', '')
)

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Shrink the bar once the user scrolls past the first chunk of the hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Track which landing section is currently in the viewport so we can
  // highlight the matching nav link. The top margin offsets the sticky
  // header so a section is considered "active" once it has cleared it.
  useEffect(() => {
    const elements = ANCHOR_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el
    )
    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target instanceof HTMLElement) {
          setActiveId(visible.target.id)
        }
      },
      {
        // Shrink the top of the intersection box by the header height so a
        // section only becomes active once it has scrolled past the header.
        rootMargin: '-90px 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Intercept in-page anchor clicks and scroll smoothly. CSS
  // scroll-behavior:smooth was removed globally because it also
  // animated Next.js route scroll-to-top. This is the scoped
  // alternative — only in-page #anchor clicks get the easing, route
  // changes stay snappy. Also updates the URL hash so copy-paste and
  // back-button navigation still work.
  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!href.startsWith('#')) return
    const target = document.getElementById(href.slice(1))
    if (!target) return
    e.preventDefault()
    // Offset by the rendered header height so the section's heading
    // doesn't land behind the fixed bar. Mobile has an extra pill row
    // (lg:hidden) that adds ~40px.
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    const headerOffset = isMobile ? 104 : 64
    const y =
      target.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: y, behavior: 'smooth' })
    // Keep the address-bar hash in sync without the default jump-to-top.
    history.replaceState(null, '', href)
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-30 border-b transition-all duration-300',
        scrolled
          ? 'border-border/70 bg-background/90 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_6px_18px_-10px_rgba(0,0,0,0.12)] backdrop-blur-xl'
          : 'border-border/40 bg-background/70 backdrop-blur-md'
      )}
    >
      {/* Top gradient hairline — visually anchors the bar to the page,
          especially useful when the background sits behind a blur. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8',
          scrolled ? 'h-14' : 'h-16'
        )}
      >
        <Link
          href="/"
          aria-label="TaskFlow home"
          className="rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo size="md" hideSubline />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 text-sm font-medium text-muted-foreground lg:flex"
        >
          {NAV_LINKS.map((l) => {
            const id = l.href.replace('#', '')
            const active = !l.isRoute && id === activeId
            const className = cn(
              'relative rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'text-foreground' : 'text-muted-foreground'
            )
            return (
              <div key={l.href} className="relative">
                {l.isRoute ? (
                  <Link href={l.href} className={className}>
                    {l.label}
                  </Link>
                ) : (
                  <a
                    href={l.href}
                    className={className}
                    onClick={(e) => handleAnchorClick(e, l.href)}
                  >
                    {l.label}
                  </a>
                )}
                {active && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary via-accent to-fuchsia-500"
                  />
                )}
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/download"
            aria-label="Download desktop application"
            className="hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden xl:inline-flex"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary to-primary/90 px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_6px_12px_-6px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_10px_20px_-8px_rgba(99,102,241,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {/* Sweeping shine — fires on hover, stays fully invisible otherwise. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <span className="relative">Start free</span>
            <ArrowRight className="relative h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Mobile / tablet — horizontally scrollable pill bar with active
          highlight that matches the desktop nav's active-section tracker. */}
      <nav
        aria-label="Sections"
        className="border-t border-border/60 lg:hidden"
      >
        <ul className="-mb-px flex overflow-x-auto px-2 py-2 text-[11px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map((l) => {
            const id = l.href.replace('#', '')
            const active = !l.isRoute && id === activeId
            const className = cn(
              'inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )
            return (
              <li key={l.href} className="shrink-0">
                {l.isRoute ? (
                  <Link href={l.href} className={className}>
                    {l.label}
                  </Link>
                ) : (
                  <a
                    href={l.href}
                    className={className}
                    onClick={(e) => handleAnchorClick(e, l.href)}
                  >
                    {l.label}
                  </a>
                )}
              </li>
            )
          })}
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
