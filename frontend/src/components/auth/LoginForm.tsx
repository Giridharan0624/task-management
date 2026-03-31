'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth/AuthProvider'
import { forgotPassword, confirmForgotPassword } from '@/lib/auth/cognitoClient'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'

interface LoginFormValues {
  email: string
  password: string
}

type Phase = 'login' | 'newPassword' | 'forgotEmail' | 'forgotCode'

export function LoginForm() {
  const { signIn, needsPasswordChange, completePasswordChange } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('login')

  // Phase 1: Login
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>()

  // Phase 2: Create password (first login)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)

  // Phase 3 & 4: Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [confirmResetPassword, setConfirmResetPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // --- Phase 1: Login ---
  const onLoginSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
      // If signIn sets needsPasswordChange, component re-renders to Phase 2
      // If signIn succeeds normally, user state is set → login page's useEffect redirects to /dashboard
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      setServerError(msg)
    }
  }

  // --- Phase 2: Set new password (first login) ---
  const onPasswordChangeSubmit = async () => {
    setChangeError(null)
    if (newPassword.length < 8) { setChangeError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setChangeError('Passwords do not match'); return }
    if (!/[A-Z]/.test(newPassword)) { setChangeError('Must contain an uppercase letter'); return }
    if (!/[a-z]/.test(newPassword)) { setChangeError('Must contain a lowercase letter'); return }
    if (!/[0-9]/.test(newPassword)) { setChangeError('Must contain a number'); return }

    setIsChanging(true)
    try {
      await completePasswordChange(newPassword)
      router.replace('/dashboard')
    } catch (err: unknown) {
      setChangeError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setIsChanging(false)
    }
  }

  // --- Phase 3: Send verification code ---
  const onForgotSubmit = async () => {
    setForgotError(null)
    if (!forgotEmail.trim()) { setForgotError('Email is required'); return }

    setForgotLoading(true)
    try {
      let email = forgotEmail.trim()
      // Resolve Employee ID to email if needed
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
      const msg = err instanceof Error ? err.message : 'Failed to send verification code'
      if (msg.includes('UserNotFoundException') || msg.includes('not found')) {
        setForgotError('No account found with this email')
      } else if (msg.includes('InvalidParameterException') || msg.includes('cannot be reset') || msg.includes('current state')) {
        setForgotError('You haven\'t set your password yet. Please check your email for the one-time password and use it to log in first.')
      } else {
        setForgotError(msg)
      }
    } finally {
      setForgotLoading(false)
    }
  }

  // --- Phase 4: Confirm reset ---
  const onResetSubmit = async () => {
    setForgotError(null)
    if (!verificationCode.trim()) { setForgotError('Verification code is required'); return }
    if (resetPassword.length < 8) { setForgotError('Password must be at least 8 characters'); return }
    if (resetPassword !== confirmResetPassword) { setForgotError('Passwords do not match'); return }
    if (!/[A-Z]/.test(resetPassword)) { setForgotError('Must contain an uppercase letter'); return }
    if (!/[a-z]/.test(resetPassword)) { setForgotError('Must contain a lowercase letter'); return }
    if (!/[0-9]/.test(resetPassword)) { setForgotError('Must contain a number'); return }

    setForgotLoading(true)
    try {
      await confirmForgotPassword(forgotEmail, verificationCode.trim(), resetPassword)
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
      const msg = err instanceof Error ? err.message : 'Failed to reset password'
      if (msg.includes('CodeMismatchException') || msg.includes('code')) {
        setForgotError('Invalid verification code. Please check and try again.')
      } else if (msg.includes('ExpiredCodeException')) {
        setForgotError('Verification code has expired. Please request a new one.')
      } else {
        setForgotError(msg)
      }
    } finally {
      setForgotLoading(false)
    }
  }

  // --- Error display helper ---
  const ErrorBanner = ({ msg }: { msg: string | null }) => msg ? (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {msg}
    </div>
  ) : null

  // --- Password requirements helper ---
  const PasswordChecklist = ({ password, confirm }: { password: string; confirm: string }) => {
    const checks = [
      { met: password.length >= 8, label: 'At least 8 characters' },
      { met: /[A-Z]/.test(password), label: '1 uppercase letter' },
      { met: /[a-z]/.test(password), label: '1 lowercase letter' },
      { met: /[0-9]/.test(password), label: '1 number' },
      { met: password === confirm && confirm.length > 0, label: 'Passwords match' },
    ]
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 mb-1">Password Requirements</p>
        {checks.map(({ met, label }) => (
          <div key={label} className="flex items-center gap-2">
            {met ? (
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>
            )}
            <span className={`text-xs ${met ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>
    )
  }

  // ============================================================
  // RENDER: Phase 2 — Create new password (first login OTP flow)
  // ============================================================
  if (needsPasswordChange) {
    const allValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && newPassword === confirmPassword && confirmPassword.length > 0
    return (
      <div className="flex flex-col gap-5">
        <PasswordInput label="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Create your password" autoFocus />
        <PasswordInput label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" />
        <PasswordChecklist password={newPassword} confirm={confirmPassword} />
        <ErrorBanner msg={changeError} />
        <Button onClick={onPasswordChangeSubmit} loading={isChanging} disabled={!allValid} className="w-full mt-1" size="lg">Set Password</Button>
      </div>
    )
  }

  // ============================================================
  // RENDER: Phase 4 — Enter code + new password
  // ============================================================
  if (phase === 'forgotCode') {
    if (forgotSuccess) {
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-lg font-bold text-gray-900">Password Reset!</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      )
    }

    const allValid = resetPassword.length >= 8 && /[A-Z]/.test(resetPassword) && /[a-z]/.test(resetPassword) && /[0-9]/.test(resetPassword) && resetPassword === confirmResetPassword && confirmResetPassword.length > 0 && verificationCode.trim().length > 0
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-500">A verification code has been sent to <span className="font-semibold text-gray-900">{forgotEmail}</span></p>
        <Input label="Verification Code" type="text" placeholder="Enter 6-digit code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} autoComplete="one-time-code" />
        <PasswordInput label="New Password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Enter new password" />
        <PasswordInput label="Confirm Password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} placeholder="Re-enter new password" />
        <PasswordChecklist password={resetPassword} confirm={confirmResetPassword} />
        <ErrorBanner msg={forgotError} />
        <Button onClick={onResetSubmit} loading={forgotLoading} disabled={!allValid} className="w-full mt-1" size="lg">Reset Password</Button>
        <button type="button" onClick={() => { setPhase('forgotEmail'); setForgotError(null) }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold text-center">
          Resend code
        </button>
      </div>
    )
  }

  // ============================================================
  // RENDER: Phase 3 — Enter email for forgot password
  // ============================================================
  if (phase === 'forgotEmail') {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-500">Enter your email address and we&apos;ll send you a verification code to reset your password.</p>
        <Input label="Email or Employee ID" type="text" placeholder="you@example.com or Employee ID" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoComplete="new-email-address" />
        <ErrorBanner msg={forgotError} />
        <Button onClick={onForgotSubmit} loading={forgotLoading} className="w-full mt-1" size="lg">Send Verification Code</Button>
        <button type="button" onClick={() => { setPhase('login'); setForgotError(null); setForgotEmail('') }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold text-center">
          Back to Login
        </button>
      </div>
    )
  }

  // ============================================================
  // RENDER: Phase 1 — Normal login
  // ============================================================
  return (
    <form onSubmit={handleSubmit(onLoginSubmit)} className="flex flex-col gap-5">
      <Input
        label="Email or Employee ID"
        type="text"
        autoComplete="username"
        placeholder="you@example.com or Employee ID"
        error={errors.email?.message}
        {...register('email', { required: 'Email or Employee ID is required' })}
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register('password', { required: 'Password is required' })}
      />

      <ErrorBanner msg={serverError} />

      <Button type="submit" loading={isSubmitting} className="w-full mt-1" size="lg">Sign in</Button>

      <button type="button" onClick={() => { setPhase('forgotEmail'); setServerError(null) }} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold text-center">
        Forgot Password?
      </button>
    </form>
  )
}

export { type Phase }
