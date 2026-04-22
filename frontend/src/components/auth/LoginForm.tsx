'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'

import { KeyRound, ShieldCheck } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { forgotPassword, confirmForgotPassword } from '@/lib/auth/cognitoClient'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'

interface LoginFormValues {
  email: string
  password: string
}

type Phase = 'login' | 'newPassword' | 'forgotEmail' | 'forgotCode'

export function LoginForm() {
  const {
    signIn,
    needsPasswordChange,
    completePasswordChange,
    needsMfaChallenge,
    completeMfaChallenge,
  } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('login')

  const [mfaCode, setMfaCode] = useState('')
  const [mfaSubmitting, setMfaSubmitting] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ mode: 'onTouched' })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)

  const [forgotEmail, setForgotEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [confirmResetPassword, setConfirmResetPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const onLoginSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Sign in failed. Please try again.'
      setServerError(msg)
    }
  }

  const onPasswordChangeSubmit = async () => {
    setChangeError(null)
    if (newPassword.length < 8) {
      setChangeError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match')
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setChangeError('Must contain an uppercase letter')
      return
    }
    if (!/[a-z]/.test(newPassword)) {
      setChangeError('Must contain a lowercase letter')
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setChangeError('Must contain a number')
      return
    }

    setIsChanging(true)
    try {
      await completePasswordChange(newPassword)
      router.replace('/dashboard')
    } catch (err: unknown) {
      setChangeError(
        err instanceof Error ? err.message : 'Failed to set password'
      )
    } finally {
      setIsChanging(false)
    }
  }

  const onForgotSubmit = async () => {
    setForgotError(null)
    if (!forgotEmail.trim()) {
      setForgotError('Email is required')
      return
    }

    setForgotLoading(true)
    try {
      let email = forgotEmail.trim()
      if (/^(EMP-\d+|[A-Z]{2,4}-[A-Z]{3}-\d{2}[A-Z0-9]+)$/i.test(email)) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
        const res = await fetch(`${apiUrl}/resolve-employee?employeeId=${email}`)
        if (!res.ok) throw new Error('Employee ID not found')
        const data = await res.json()
        email = data.email
        setForgotEmail(email)
      }
      await forgotPassword(email)
      setPhase('forgotCode')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to send verification code'
      if (msg.includes('UserNotFoundException') || msg.includes('not found')) {
        setForgotError('No account found with this email')
      } else if (
        msg.includes('InvalidParameterException') ||
        msg.includes('cannot be reset') ||
        msg.includes('current state')
      ) {
        setForgotError(
          "You haven't set your password yet. Please check your email for the one-time password and use it to log in first."
        )
      } else {
        setForgotError(msg)
      }
    } finally {
      setForgotLoading(false)
    }
  }

  const onResetSubmit = async () => {
    setForgotError(null)
    if (!verificationCode.trim()) {
      setForgotError('Verification code is required')
      return
    }
    if (resetPassword.length < 8) {
      setForgotError('Password must be at least 8 characters')
      return
    }
    if (resetPassword !== confirmResetPassword) {
      setForgotError('Passwords do not match')
      return
    }
    if (!/[A-Z]/.test(resetPassword)) {
      setForgotError('Must contain an uppercase letter')
      return
    }
    if (!/[a-z]/.test(resetPassword)) {
      setForgotError('Must contain a lowercase letter')
      return
    }
    if (!/[0-9]/.test(resetPassword)) {
      setForgotError('Must contain a number')
      return
    }

    setForgotLoading(true)
    try {
      await confirmForgotPassword(
        forgotEmail,
        verificationCode.trim(),
        resetPassword
      )
      setForgotSuccess(true)
      setTimeout(() => {
        setPhase('login')
        setForgotSuccess(false)
        setForgotEmail('')
        setVerificationCode('')
        setResetPassword('')
        setConfirmResetPassword('')
      }, 2000)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to reset password'
      if (msg.includes('CodeMismatchException') || msg.includes('code')) {
        setForgotError('Invalid verification code. Please check and try again.')
      } else if (msg.includes('ExpiredCodeException')) {
        setForgotError(
          'Verification code has expired. Please request a new one.'
        )
      } else {
        setForgotError(msg)
      }
    } finally {
      setForgotLoading(false)
    }
  }

  const ErrorBanner = ({ msg }: { msg: string | null }) =>
    msg ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    ) : null

  const PasswordChecklist = ({
    password,
    confirm,
  }: {
    password: string
    confirm: string
  }) => {
    const checks = [
      { met: password.length >= 8, label: 'At least 8 characters' },
      { met: /[A-Z]/.test(password), label: '1 uppercase letter' },
      { met: /[a-z]/.test(password), label: '1 lowercase letter' },
      { met: /[0-9]/.test(password), label: '1 number' },
      {
        met: password === confirm && confirm.length > 0,
        label: 'Passwords match',
      },
    ]
    return (
      <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          Password Requirements
        </p>
        {checks.map(({ met, label }) => (
          <div key={label} className="flex items-center gap-2">
            {met ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
            <span
              className={cn(
                'text-xs',
                met
                  ? 'font-medium text-emerald-600'
                  : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMfaError(null)
    const trimmed = mfaCode.trim()
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setMfaError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setMfaSubmitting(true)
    try {
      await completeMfaChallenge(trimmed)
      router.replace('/dashboard')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Verification failed. Try again.'
      if (
        msg.includes('CodeMismatchException') ||
        msg.toLowerCase().includes('code')
      ) {
        setMfaError('Code did not match. Check the app and re-enter.')
      } else {
        setMfaError(msg)
      }
      setMfaCode('')
      setMfaSubmitting(false)
    }
  }

  if (needsMfaChallenge) {
    return (
      <form onSubmit={onMfaSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">
            Two-factor verification
          </p>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code from your authenticator app to finish
            signing in.
          </p>
        </div>
        <Input
          label="Authenticator code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={mfaCode}
          onChange={(e) =>
            setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          maxLength={6}
          autoFocus
        />
        <ErrorBanner msg={mfaError} />
        <Button
          type="submit"
          loading={mfaSubmitting}
          disabled={mfaCode.length !== 6}
          className="w-full"
          size="lg"
        >
          <KeyRound className="h-4 w-4" />
          Verify + sign in
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Lost access to your authenticator? Ask your workspace owner to
          reset 2FA from the admin Users page.
        </p>
      </form>
    )
  }

  if (needsPasswordChange) {
    const allValid =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      newPassword === confirmPassword &&
      confirmPassword.length > 0
    return (
      <div className="flex flex-col gap-4">
        <PasswordInput
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Create your password"
          autoFocus
        />
        <PasswordInput
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
        />
        <PasswordChecklist password={newPassword} confirm={confirmPassword} />
        <ErrorBanner msg={changeError} />
        <Button
          onClick={onPasswordChangeSubmit}
          loading={isChanging}
          disabled={!allValid}
          className="w-full"
          size="lg"
        >
          Set Password
        </Button>
      </div>
    )
  }

  if (phase === 'forgotCode') {
    if (forgotSuccess) {
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <p className="text-lg font-bold text-foreground">Password Reset!</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      )
    }

    const allValid =
      resetPassword.length >= 8 &&
      /[A-Z]/.test(resetPassword) &&
      /[a-z]/.test(resetPassword) &&
      /[0-9]/.test(resetPassword) &&
      resetPassword === confirmResetPassword &&
      confirmResetPassword.length > 0 &&
      verificationCode.trim().length > 0
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          A verification code has been sent to{' '}
          <span className="font-semibold text-foreground">{forgotEmail}</span>
        </p>
        <Input
          label="Verification Code"
          type="text"
          placeholder="Enter 6-digit code"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          autoComplete="one-time-code"
        />
        <PasswordInput
          label="New Password"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          placeholder="Enter new password"
        />
        <PasswordInput
          label="Confirm Password"
          value={confirmResetPassword}
          onChange={(e) => setConfirmResetPassword(e.target.value)}
          placeholder="Re-enter new password"
        />
        <PasswordChecklist
          password={resetPassword}
          confirm={confirmResetPassword}
        />
        <ErrorBanner msg={forgotError} />
        <Button
          onClick={onResetSubmit}
          loading={forgotLoading}
          disabled={!allValid}
          className="w-full"
          size="lg"
        >
          Reset Password
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setPhase('forgotEmail')
            setForgotError(null)
          }}
          className="mx-auto"
        >
          Resend code
        </Button>
      </div>
    )
  }

  if (phase === 'forgotEmail') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Enter your email address and we&apos;ll send you a verification code to
          reset your password.
        </p>
        <Input
          label="Email or Employee ID"
          type="text"
          placeholder="you@example.com or Employee ID"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          autoComplete="new-email-address"
        />
        <ErrorBanner msg={forgotError} />
        <Button
          onClick={onForgotSubmit}
          loading={forgotLoading}
          className="w-full"
          size="lg"
        >
          Send Verification Code
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setPhase('login')
            setForgotError(null)
            setForgotEmail('')
          }}
          className="mx-auto"
        >
          Back to Login
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onLoginSubmit)}
      className="flex flex-col gap-4"
    >
      <Input
        label="Email or Employee ID"
        type="text"
        autoComplete="username"
        placeholder="you@example.com or Employee ID"
        error={errors.email?.message}
        {...register('email', {
          required: 'Email or Employee ID is required',
        })}
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register('password', { required: 'Password is required' })}
      />

      <ErrorBanner msg={serverError} />

      <Button
        type="submit"
        loading={isSubmitting}
        className="w-full"
        size="lg"
      >
        Sign in
      </Button>

      <Button
        type="button"
        variant="link"
        onClick={() => {
          setPhase('forgotEmail')
          setServerError(null)
        }}
        className="mx-auto"
      >
        Forgot Password?
      </Button>
    </form>
  )
}

export { type Phase }
