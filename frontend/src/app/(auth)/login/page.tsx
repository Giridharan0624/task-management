'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Clock,
  KanbanSquare,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { Spinner } from '@/components/ui/Spinner'
import { Logo } from '@/components/ui/Logo'
import { Card } from '@/components/ui/Card'

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      if (user.emailVerified === false) {
        router.replace('/verify-email')
        return
      }
      router.replace('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo size="lg" hideSubline />
        <Spinner size="md" />
        <p className="animate-pulse text-xs font-medium text-muted-foreground">
          Checking authentication...
        </p>
      </div>
    )
  }

  if (user) return null

  const features = [
    { name: 'Task pipelines', Icon: KanbanSquare },
    { name: 'Live time tracking', Icon: Clock },
    { name: 'Cross-project reports', Icon: BarChart3 },
    { name: 'Role-based access', Icon: ShieldCheck },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* ─── Left — sophisticated dark brand panel ────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-[#0a0a14] p-12 text-white lg:flex xl:p-16">
        {/* Single subtle colour wash in the top-right; no saturated fill */}
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

        {/* Very fine grid — barely visible, adds texture without noise */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Top edge highlight — quietly anchors the panel */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        {/* Top row — logo */}
        <div className="relative z-10">
          <Logo size="lg" hideSubline onDark />
        </div>

        {/* Middle — editorial typography; no decorative gradient on text */}
        <div className="relative z-10 flex max-w-lg flex-col gap-12">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
              Workspace login
            </p>
            <h1 className="animate-fade-in text-[48px] font-semibold leading-[1.05] tracking-tight text-white text-balance">
              The operating system for teams that ship.
            </h1>
            <p className="mt-6 max-w-md animate-fade-in-delay-1 text-[15px] leading-relaxed text-white/65">
              Projects, tasks, time, and daily reporting — consolidated into
              a single workspace, built for accountability.
            </p>
          </div>

          {/* Feature rail — thin hairline chips, no heavy glass cards */}
          <ul className="grid animate-fade-in-delay-2 grid-cols-2 gap-x-4 gap-y-3">
            {features.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10">
                  <f.Icon className="h-4 w-4 text-white/90" strokeWidth={1.8} />
                </div>
                <span className="text-[13px] font-semibold text-white/85">
                  {f.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom row — small, restrained */}
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

      {/* ─── Right — clean light surface, quiet and crisp ─────────── */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile-only logo bar */}
          <div className="mb-10 flex justify-center lg:hidden">
            <Logo size="lg" hideSubline />
          </div>

          <div className="mb-8">
            <NeedsPwHeading />
          </div>

          <Card className="border-border/70 p-6 shadow-[0_4px_32px_-8px_rgba(10,10,30,0.08)]">
            <LoginForm />
          </Card>

          <div className="mt-6 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Secured by AWS Cognito
            </span>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Create workspace
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function NeedsPwHeading() {
  const { needsPasswordChange } = useAuth()
  if (needsPasswordChange) {
    return (
      <>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Create your password
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please set a new password to continue.
        </p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        Welcome back
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to continue to your workspace.
      </p>
    </>
  )
}
