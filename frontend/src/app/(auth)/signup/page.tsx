import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import { SignupForm } from '@/components/auth/SignupForm'
import { Logo } from '@/components/ui/Logo'
import { Card } from '@/components/ui/Card'

export default function SignupPage() {
  const pillars = [
    { Icon: Users, name: 'Bring your team' },
    { Icon: Sparkles, name: 'Ready in minutes' },
    { Icon: CheckCircle2, name: 'Free to start' },
    { Icon: ShieldCheck, name: 'SOC-grade security' },
  ]

  return (
    <div className="flex min-h-screen bg-background lg:h-screen lg:overflow-hidden">
      {/* ─── Left — sophisticated dark brand panel ────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-[#0a0a14] p-12 text-white lg:flex lg:h-screen xl:p-16">
        {/* Subtle color washes only at corners */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0) 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 h-[520px] w-[520px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(217,70,239,0.14) 0%, rgba(217,70,239,0) 70%)',
          }}
        />

        {/* Fine grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Top edge highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        {/* Top — logo */}
        <div className="relative z-10">
          <Logo size="lg" hideSubline onDark />
        </div>

        {/* Middle — editorial typography */}
        <div className="relative z-10 flex max-w-lg flex-col gap-12">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
              Get started
            </p>
            <h1 className="animate-fade-in text-[48px] font-semibold leading-[1.05] tracking-tight text-white text-balance">
              Provision your team&apos;s command center in under a minute.
            </h1>
            <p className="mt-6 max-w-md animate-fade-in-delay-1 text-[15px] leading-relaxed text-white/65">
              Create a workspace, invite your team, and start tracking projects,
              tasks, and time — no setup calls, no onboarding fees.
            </p>
          </div>

          {/* Pillar rail — hairline chips matching the login page */}
          <ul className="grid animate-fade-in-delay-2 grid-cols-2 gap-x-4 gap-y-3">
            {pillars.map((p) => (
              <li
                key={p.name}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10">
                  <p.Icon className="h-4 w-4 text-white/90" strokeWidth={1.8} />
                </div>
                <span className="text-[13px] font-semibold text-white/85">
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom — legal + copyright */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-white/50">
          <span>© {new Date().getFullYear()} TaskFlow</span>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white/80"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-white/80"
            >
              Terms
            </Link>
            <Link
              href="/security"
              className="transition-colors hover:text-white/80"
            >
              Security
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Right — clean light surface. On lg+ this column scrolls
          independently of the left brand panel. The inner uses
          `m-auto`: when the form fits in the viewport the auto
          margins centre it; when the form is taller than the
          viewport the auto margins collapse to 0 and the form
          anchors to the top so the heading stays visible (avoids
          the items-center "scroll past the top" trap autoFocus
          triggers). */}
      <div className="flex flex-col flex-1 overflow-y-auto bg-background lg:h-screen">
        <div className="m-auto w-full max-w-md px-6 py-12 animate-fade-in">
          {/* Mobile-only logo bar */}
          <div className="mb-10 flex justify-center lg:hidden">
            <Logo size="lg" hideSubline />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Create your workspace
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start managing your team in minutes. No credit card required.
            </p>
          </div>

          <Card className="border-border/70 p-6 shadow-[0_4px_32px_-8px_rgba(10,10,30,0.08)]">
            <SignupForm />
          </Card>

          <div className="mt-6 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Secured by AWS Cognito
            </span>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Have an account? Sign in
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
