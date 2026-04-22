'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Mail, RotateCw } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import {
  sendEmailVerificationCode,
  verifyEmailCode,
} from '@/lib/auth/cognitoClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Logo } from '@/components/ui/Logo'

/**
 * Post-login email verification gate.
 *
 * Flow:
 *   1. Arrive here because AuthProvider saw `emailVerified=false` on
 *      the decoded JWT (or because the dashboard layout redirected).
 *   2. Click "Send code" — calls Cognito `GetUserAttributeVerificationCode`
 *      via the amazon-cognito-identity-js wrapper. Cognito emails a
 *      6-digit code using the pool's UserVerificationConfig template.
 *   3. Enter code + "Verify" — calls `VerifyUserAttribute`. Cognito
 *      flips `email_verified=true` server-side.
 *   4. Force a token refresh so the new claim lands in the local JWT,
 *      then push back to `/dashboard`.
 *
 * The send-code step is **not** auto-fired on page load — a form
 * reload shouldn't rate-limit the user out of their own account. The
 * user explicitly asks for the code with a button press.
 */
export default function VerifyEmailPage() {
  const { user, refreshSession, signOut, isLoading } = useAuth()
  const router = useRouter()

  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // Already verified — nothing to do, bounce to dashboard.
    if (user.emailVerified !== false) {
      router.replace('/dashboard')
    }
  }, [isLoading, user, router])

  const onSend = async () => {
    setSendError(null)
    setSending(true)
    try {
      await sendEmailVerificationCode()
      setCodeSent(true)
    } catch (e) {
      setSendError(
        e instanceof Error
          ? e.message
          : 'Could not send code. Please try again.',
      )
    } finally {
      setSending(false)
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
      // Cognito flipped the attribute. Pull a fresh ID token so the
      // local user state reflects the new `email_verified=true` claim
      // — otherwise AuthProvider's decoded user stays stale for up to
      // one token TTL and the dashboard would bounce us right back here.
      await refreshSession()
      router.replace('/dashboard')
    } catch (e) {
      setVerifyError(
        e instanceof Error ? e.message : 'Verification failed. Try again.',
      )
      setVerifying(false)
    }
  }

  if (isLoading || !user) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" hideSubline />
        </div>

        <Card className="p-6 shadow-card">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-foreground">
              Verify your email
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll send a 6-digit code to{' '}
              <span className="font-semibold text-foreground">{user.email}</span>.
            </p>
          </div>

          {!codeSent ? (
            <>
              {sendError && (
                <Alert variant="destructive" className="mt-5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{sendError}</AlertDescription>
                </Alert>
              )}
              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={onSend}
                loading={sending}
              >
                Send verification code
              </Button>
            </>
          ) : (
            <form onSubmit={onVerify} className="mt-6 flex flex-col gap-4">
              <Alert className="border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Code sent. Check your inbox (and spam folder) for a
                  6-digit code.
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

              <Button
                type="submit"
                size="lg"
                loading={verifying}
                disabled={code.length !== 6}
              >
                Verify email
              </Button>

              <button
                type="button"
                onClick={onSend}
                disabled={sending}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                <RotateCw className="h-3 w-3" />
                {sending ? 'Resending...' : 'Resend code'}
              </button>
            </form>
          )}
        </Card>

        <button
          type="button"
          onClick={signOut}
          className="mt-4 block w-full text-center text-[11px] text-muted-foreground hover:underline"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}
