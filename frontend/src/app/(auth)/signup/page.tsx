'use client'

import { useState } from 'react'
import { CheckCircle2, Hash, Sparkles, Users } from 'lucide-react'

import { SignupForm } from '@/components/auth/SignupForm'
import { Logo } from '@/components/ui/Logo'
import { Card } from '@/components/ui/Card'

export default function SignupPage() {
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const pillars = [
    {
      Icon: Users,
      name: 'Bring your team',
      desc: 'Invite teammates with one click.',
    },
    {
      Icon: Sparkles,
      name: 'Ready in minutes',
      desc: 'Pre-built roles, pipelines, and workflows.',
    },
    {
      Icon: CheckCircle2,
      name: 'Free to start',
      desc: 'No credit card. Cancel anytime.',
    },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — branding panel */}
      <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-16 lg:flex">
        {/* Floating orbs */}
        <div className="absolute left-[15%] top-[10%] h-72 w-72 animate-float rounded-full bg-primary/15 blur-3xl" />
        <div
          className="absolute bottom-[15%] right-[10%] h-64 w-64 animate-float rounded-full bg-accent/15 blur-3xl"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute left-[55%] top-[45%] h-48 w-48 animate-float rounded-full bg-primary/10 blur-3xl"
          style={{ animationDelay: '4s' }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(var(--color-primary)) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10">
          <Logo size="xl" hideSubline />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Get started
            </span>
            <h1 className="animate-fade-in text-[40px] font-bold leading-[1.1] tracking-tight text-foreground text-balance">
              Spin up your team&apos;s{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                command center
              </span>{' '}
              in under a minute.
            </h1>
            <p className="mt-4 animate-fade-in-delay-1 text-[15px] leading-relaxed text-muted-foreground">
              Create a workspace, invite your team, and start tracking projects,
              tasks, and time — no setup calls, no onboarding fees.
            </p>
          </div>

          {/* Live workspace code preview */}
          <Card className="flex animate-fade-in-delay-2 items-center gap-3 border-dashed p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hash className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your workspace code
              </p>
              <p className="truncate font-mono text-sm font-semibold text-foreground">
                {slug || 'your-team'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Team members use this code to sign in.
              </p>
            </div>
          </Card>

          <div className="grid animate-fade-in-delay-2 grid-cols-1 gap-3">
            {pillars.map((p) => (
              <Card
                key={p.name}
                className="flex items-start gap-3 border-border/60 bg-card/60 p-3.5 backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:shadow-card-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <p.Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex -space-x-2">
            {['bg-primary/80', 'bg-accent/80', 'bg-emerald-500/80'].map(
              (bg, i) => (
                <div
                  key={i}
                  className={`h-6 w-6 rounded-full border-2 border-background ${bg}`}
                />
              )
            )}
          </div>
          <span>Trusted by teams shipping every day.</span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="lg" hideSubline />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Create your workspace
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start managing your team in minutes. No credit card required.
            </p>
          </div>

          <Card className="p-6 shadow-card">
            <SignupForm
              slug={slug}
              onSlugChange={setSlug}
              slugTouched={slugTouched}
              onSlugTouchedChange={setSlugTouched}
            />
          </Card>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Secure sign-in via AWS Cognito
          </p>
        </div>
      </div>
    </div>
  )
}
