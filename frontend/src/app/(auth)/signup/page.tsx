'use client'

import { SignupForm } from '@/components/auth/SignupForm'
import { Logo } from '@/components/ui/Logo'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0f1117]">
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Create your workspace
            </h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              Start managing your team in minutes. No credit card required.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1a1c25] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2d3a]">
            <SignupForm />
          </div>

          <p className="mt-6 text-center text-[10px] text-gray-400 dark:text-gray-500">
            Powered by{' '}
            <span className="font-semibold text-gray-500 dark:text-gray-400">
              NEUROSTACK
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
