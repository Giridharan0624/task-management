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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg)] gap-4">
        <Logo size="lg" />
        <Spinner size="md" />
        <p className="text-[12px] text-gray-400 font-medium animate-pulse">Checking authentication...</p>
      </div>
    )
  }

  if (user) return null

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0f1117]">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center p-16 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-[#0f1117] dark:via-[#141625] dark:to-[#1a1040] border-r border-gray-200 dark:border-[#2a2d3a]">
        {/* Floating shapes */}
        <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-indigo-200/40 dark:bg-indigo-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-64 h-64 rounded-full bg-violet-200/40 dark:bg-violet-500/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[45%] left-[55%] w-48 h-48 rounded-full bg-cyan-100/30 dark:bg-cyan-500/8 blur-3xl animate-float" style={{ animationDelay: '4s' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }} />

        <div className="relative z-10 max-w-lg">
          <Logo size="xl" className="mb-10" />

          <h1 className="text-[42px] font-bold leading-[1.1] mb-5 text-gray-900 dark:text-white tracking-tight animate-fade-in">
            Manage your team&apos;s work,{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
              effortlessly.
            </span>
          </h1>

          <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-10 animate-fade-in-delay-1">
            Track projects, assign tasks, monitor time, and keep your entire team in sync — all in one place.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 animate-fade-in-delay-2">
            {[
              { name: 'Task Pipeline', desc: 'Domain-specific workflows', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg> },
              { name: 'Time Tracking', desc: 'Live session timer', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { name: 'Reports & Analytics', desc: 'Attendance & progress', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
              { name: 'Role-Based Access', desc: '3-tier permission system', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
            ].map((feature) => (
              <div key={feature.name} className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1] shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all duration-200">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex-shrink-0">
                  <span className="text-indigo-600 dark:text-indigo-400">{feature.icon}</span>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-800 dark:text-white/90">{feature.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-white/40">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attribution */}
          <p className="mt-14 text-[11px] text-gray-400 dark:text-white/30 animate-fade-in-delay-3">
            Powered by <span className="font-semibold text-gray-500 dark:text-white/50">NEUROSTACK</span>
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <div className="mb-6">
            <NeedsPwHeading />
          </div>

          <div className="bg-white dark:bg-[#1a1c25] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2d3a]">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-[10px] text-gray-400 dark:text-gray-500">
            Powered by <span className="font-semibold text-gray-500 dark:text-gray-400">NEUROSTACK</span> · Secure login via AWS Cognito
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Your Password</h2>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">Please set a new password to continue</p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">Sign in to continue to your workspace</p>
    </>
  )
}
