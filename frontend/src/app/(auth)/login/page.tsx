'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { Spinner } from '@/components/ui/Spinner'
import { Logo } from '@/components/ui/Logo'

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
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0f1117]">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center p-16 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-[#0f1117] dark:via-[#141625] dark:to-[#1a1040]">
        {/* Floating shapes */}
        <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-indigo-100/50 dark:bg-indigo-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-64 h-64 rounded-full bg-violet-100/40 dark:bg-violet-500/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[45%] left-[55%] w-48 h-48 rounded-full bg-cyan-100/30 dark:bg-cyan-500/8 blur-3xl animate-float" style={{ animationDelay: '4s' }} />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.15] dark:opacity-[0.06]" style={{
          backgroundImage: `radial-gradient(circle, #c7d2fe 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }} />

        <div className="relative z-10 max-w-lg">
          <Logo size="xl" className="mb-10" />

          <h1 className="text-5xl font-bold leading-[1.1] mb-5 text-gray-900 dark:text-white text-balance animate-fade-in">
            Manage your team&apos;s work,{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
              effortlessly.
            </span>
          </h1>

          <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-10 animate-fade-in-delay-1" style={{ opacity: 0 }}>
            Track projects, assign tasks, monitor progress, and keep your team in sync — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 animate-fade-in-delay-2" style={{ opacity: 0 }}>
            {[
              { name: 'Kanban Boards', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg> },
              { name: 'Time Tracking', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { name: 'Team Management', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { name: 'Role-Based Access', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
            ].map((feature) => (
              <span key={feature.name} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-white/[0.08] shadow-sm dark:shadow-none">
                <span className="text-indigo-500 dark:text-indigo-400">{feature.icon}</span>
                {feature.name}
              </span>
            ))}
          </div>

          {/* NEUROSTACK attribution */}
          <p className="mt-12 text-xs text-gray-400 dark:text-gray-500 animate-fade-in-delay-3" style={{ opacity: 0 }}>
            Powered by <span className="font-semibold text-gray-500 dark:text-gray-400">NEUROSTACK</span>
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Logo size="lg" />
          </div>

          <div className="mb-8">
            <NeedsPwHeading />
          </div>

          <div className="bg-white dark:bg-[#1a1c25] rounded-2xl p-7 shadow-card border border-gray-100 dark:border-[#2a2d3a]">
            <LoginForm />
          </div>

          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            Powered by <span className="font-semibold text-gray-500 dark:text-gray-400">NEUROSTACK</span> &middot; Secure login via AWS Cognito
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
        <h2 className="text-2xl font-bold text-gray-900">Create Your Password</h2>
        <p className="mt-1.5 text-sm text-gray-500">Please set a new password to continue</p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
      <p className="mt-1.5 text-sm text-gray-500">Sign in to continue to your workspace</p>
    </>
  )
}
