'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { Spinner } from '@/components/ui/Spinner'

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
    <div className="flex min-h-screen bg-white">
      {/* Left — light branding panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center p-16 bg-gradient-to-br from-indigo-50 via-white to-violet-50">
        {/* Soft floating shapes */}
        <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-indigo-100/50 blur-3xl animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-64 h-64 rounded-full bg-violet-100/40 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[45%] left-[55%] w-48 h-48 rounded-full bg-cyan-100/30 blur-3xl animate-float" style={{ animationDelay: '4s' }} />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: `radial-gradient(circle, #c7d2fe 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }} />

        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tight">TaskFlow</span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.1] mb-5 text-gray-900 text-balance animate-fade-in">
            Manage your team&apos;s work,{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
              effortlessly.
            </span>
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed mb-10 animate-fade-in-delay-1" style={{ opacity: 0 }}>
            Track projects, assign tasks, monitor progress, and keep your team in sync — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 animate-fade-in-delay-2" style={{ opacity: 0 }}>
            {['Kanban Boards', 'Time Tracking', 'Team Management', 'RBAC'].map((feature) => (
              <span key={feature} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-gray-700 border border-gray-100 shadow-sm">
                <svg className="w-3.5 h-3.5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">TaskFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-gray-500">Sign in to continue to your workspace</p>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-card border border-gray-100">
            <LoginForm />
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            Powered by TaskFlow &middot; Secure login via AWS Cognito
          </p>
        </div>
      </div>
    </div>
  )
}
