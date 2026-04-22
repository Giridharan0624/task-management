'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Mail, RotateCw } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import {
  requestEmailChange,
  verifyEmailCode,
} from '@/lib/auth/cognitoClient'
import { syncEmail } from '@/lib/api/userApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'

/**
 * Self-service email change.
 *
 * Two phases:
 *   1. **Request** — user types a new email, backend-side work is zero
 *      (Cognito handles everything). The Cognito SDK stages the new
 *      address, sets `email_verified=false`, and mails a 6-digit code.
 *   2. **Verify** — user enters the code, Cognito commits the swap, we
 *      force a token refresh so the JWT's email claim updates, then
 *      call `PUT /users/me/email` to sync the DDB user record.
 *
 * Until the code is verified the user's sign-in email is still the
 * old one — Cognito doesn't swap until verification succeeds.
 */
export default function ChangeEmailPage() {
  const { user, refreshSession, updateUser } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [phase, setPhase] = useState<'request' | 'verify'>('request')
  const [newEmail, setNewEmail] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  if (!user) return null

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = EMAIL_RE.test(newEmail.trim())
  const isDifferent =
    newEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
  const canRequest = isValidEmail && isDifferent && !requesting

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setRequestError(null)
    setRequesting(true)
    try {
      await requestEmailChange(newEmail.trim().toLowerCase())
      setPhase('verify')
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : 'Could not start email change. Please try again.',
      )
    } finally {
      setRequesting(false)
    }
  }

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setVerifyError('Enter the 6-digit code from the email.')
      return
    }
    setVerifyError(null)
    setVerifying(true)
    try {
      await verifyEmailCode(trimmed)
      // Pull a fresh ID token so the JWT reflects the new email + the
      // freshly-flipped email_verified=true claim.
      await refreshSession()
      // Backend sync — write the new email onto the DDB user record.
      // Silent-fail is fine here; Cognito is the source of truth for
      // the attribute and the next refresh will re-trigger sync.
      try {
        await syncEmail()
      } catch {
        // Ignore — the profile-fetch on next page load will still
        // read the new email from the refreshed JWT claim.
      }
      // Optimistically update local auth state with the new email.
      updateUser({ email: newEmail.trim().toLowerCase() })
      toast.success('Email updated.')
      router.replace('/profile')
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Verification failed. Try again.',
      )
      setVerifying(false)
    }
  }

  const onResend = async () => {
    setVerifyError(null)
    try {
      await requestEmailChange(newEmail.trim().toLowerCase())
      toast.success('Code resent.')
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : 'Could not resend code.',
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Change email"
        description="Update the email you use to sign in."
        breadcrumbs={[
          { label: 'Profile', href: '/profile' },
          { label: 'Change email' },
        ]}
      />

      <Card className="p-6 shadow-card">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Current email
          </p>
          <p className="text-sm font-semibold text-foreground">
            {user.email}
          </p>
        </div>

        {phase === 'request' ? (
          <form onSubmit={onRequest} className="mt-6 flex flex-col gap-4">
            <Input
              label="New email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              hint={
                !newEmail.trim()
                  ? "We'll mail a 6-digit code to this address to confirm you own it."
                  : !isValidEmail
                    ? 'That email format looks off.'
                    : !isDifferent
                      ? 'Enter a different email from your current one.'
                      : 'We\'ll mail a code to confirm ownership.'
              }
            />

            {requestError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              loading={requesting}
              disabled={!canRequest}
            >
              Send verification code
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 flex flex-col gap-4">
            <Alert className="border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Code sent to{' '}
                <strong className="font-semibold">{newEmail}</strong>. Check
                your inbox and spam folder.
              </AlertDescription>
            </Alert>

            <Input
              label="Verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              maxLength={6}
              autoFocus
            />

            {verifyError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{verifyError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPhase('request')
                  setCode('')
                  setVerifyError(null)
                }}
                disabled={verifying}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                size="lg"
                loading={verifying}
                disabled={code.length !== 6}
              >
                Verify + update
              </Button>
            </div>

            <button
              type="button"
              onClick={onResend}
              disabled={verifying}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <RotateCw className="h-3 w-3" />
              Resend code
            </button>
          </form>
        )}
      </Card>
    </div>
  )
}
