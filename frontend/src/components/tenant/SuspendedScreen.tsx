'use client'

import { Ban, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/lib/auth/AuthProvider'

/**
 * Full-page block rendered whenever the current tenant's org status is
 * SUSPENDED. Every authenticated route in the dashboard layout gates
 * through this — reads and writes are both disabled to avoid confusing
 * half-working states.
 *
 * Signing out is the only action we keep available so a user who
 * mistakenly logged into the wrong workspace can recover without
 * needing an admin.
 */
export function SuspendedScreen({ orgName }: { orgName?: string }) {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <Logo size="md" />
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-foreground">
            Workspace suspended
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {orgName ? (
              <>
                <span className="font-semibold text-foreground">{orgName}</span>{' '}
                is currently suspended.{' '}
              </>
            ) : (
              'This workspace is currently suspended. '
            )}
            Contact the platform operator to restore access.
          </p>

          <a
            href="mailto:support@taskflow.neurostack.in"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Mail className="h-4 w-4" />
            support@taskflow.neurostack.in
          </a>

          <Button
            variant="secondary"
            size="sm"
            onClick={signOut}
            className="mt-6 w-full"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
