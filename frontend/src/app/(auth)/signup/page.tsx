'use client'

import { SignupForm } from '@/components/auth/SignupForm'
import { Logo } from '@/components/ui/Logo'
import { Card } from '@/components/ui/Card'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex justify-center">
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
            <SignupForm />
          </Card>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Your workspace, your rules.
          </p>
        </div>
      </div>
    </div>
  )
}
