'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  KanbanSquare,
  Clock,
  BarChart3,
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
      router.replace('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo size="lg" />
        <Spinner size="md" />
        <p className="animate-pulse text-xs font-medium text-muted-foreground">
          Checking authentication...
        </p>
      </div>
    )
  }

  if (user) return null

  const features = [
    {
      name: 'Task Pipeline',
      desc: 'Domain-specific workflows',
      Icon: KanbanSquare,
    },
    {
      name: 'Time Tracking',
      desc: 'Live session timer',
      Icon: Clock,
    },
    {
      name: 'Reports & Analytics',
      desc: 'Attendance & progress',
      Icon: BarChart3,
    },
    {
      name: 'Role-Based Access',
      desc: '3-tier permission system',
      Icon: ShieldCheck,
    },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — branding panel */}
      <div className="relative hidden w-[55%] items-center justify-center overflow-hidden border-r border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-16 lg:flex">
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

        <div className="relative z-10 max-w-lg">
          <Logo size="xl" className="mb-10" />

          <h1 className="mb-5 animate-fade-in text-[42px] font-bold leading-[1.1] tracking-tight text-foreground text-balance">
            Manage your team&apos;s work,{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              effortlessly.
            </span>
          </h1>

          <p className="mb-10 animate-fade-in-delay-1 text-[15px] leading-relaxed text-muted-foreground">
            Track projects, assign tasks, monitor time, and keep your entire
            team in sync — all in one place.
          </p>

          <div className="grid animate-fade-in-delay-2 grid-cols-2 gap-3">
            {features.map((feature) => (
              <Card
                key={feature.name}
                className="flex items-start gap-3 p-3.5 transition-all duration-200 hover:border-primary/30 hover:shadow-card-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <feature.Icon
                    className="h-5 w-5 text-primary"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground">
                    {feature.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {feature.desc}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <p className="mt-14 animate-fade-in-delay-3 text-[11px] text-muted-foreground/70">
            Powered by{' '}
            <span className="font-semibold text-muted-foreground">
              NEUROSTACK
            </span>
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="lg" />
          </div>

          <div className="mb-6">
            <NeedsPwHeading />
          </div>

          <Card className="p-6 shadow-card">
            <LoginForm />
          </Card>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Powered by{' '}
            <span className="font-semibold">NEUROSTACK</span> · Secure login via
            AWS Cognito
          </p>
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Create Your Password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please set a new password to continue
        </p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Welcome back
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in to continue to your workspace
      </p>
    </>
  )
}
