'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, IdCard, Mail, User as UserIcon } from 'lucide-react'

import { orgsApi } from '@/lib/api/orgsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { HCaptchaWidget } from '@/components/auth/HCaptchaWidget'

interface SignupFormValues {
  orgName: string
  employeeIdPrefix: string
  ownerName: string
  ownerEmail: string
  password: string
  confirmPassword: string
}

/** Browser-detected IANA timezone. Falls back to a sensible default
 *  if Intl isn't available (very old browsers / SSR). The owner can
 *  override this later in /settings/organization. */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  } catch {
    return 'Asia/Kolkata'
  }
}

/** Suggest a 3-char employee-ID prefix from the org name. Strips
 *  non-letters, takes the initials of the first 3 words, falls back
 *  to "EMP" if that yields nothing usable. Just a default — the
 *  owner can edit before submitting. */
function suggestPrefix(orgName: string): string {
  const cleaned = orgName.toUpperCase().replace(/[^A-Z\s]/g, '').trim()
  if (!cleaned) return 'EMP'
  const initials = cleaned
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
  if (initials.length >= 2) return initials.slice(0, 4)
  // Single-word org names: take the first 3-4 letters.
  return cleaned.replace(/\s+/g, '').slice(0, 4) || 'EMP'
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)

/** Append a short random suffix to avoid clashing with an existing slug.
 *  We favour the human-readable base when it's available; the suffix is
 *  only appended if the caller tells us the plain form was already taken. */
function withRandomSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  // Keep the combined length under the 30-char slug limit.
  const trimmedBase = base.slice(0, 25).replace(/-+$/, '')
  return `${trimmedBase || 'workspace'}-${suffix}`
}

export function SignupForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [serverError, setServerError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaEnabled = !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ mode: 'onTouched' })

  const orgName = watch('orgName') ?? ''
  const password = watch('password') ?? ''

  const strength = usePasswordStrength(password)

  const goNext = async () => {
    const ok = await trigger(['orgName'])
    if (!ok) return
    setServerError(null)
    // Pre-fill the employee-ID prefix from the org name so the owner
    // doesn't have to think about it. They can edit before submitting.
    setValue('employeeIdPrefix', suggestPrefix(orgName), {
      shouldValidate: false,
    })
    setStep(2)
  }

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null)
    if (captchaEnabled && !captchaToken) {
      setServerError('Please complete the captcha to continue.')
      return
    }

    const trimmedOrgName = values.orgName.trim()
    const baseSlug = slugify(trimmedOrgName)
    if (!baseSlug) {
      setServerError('Please enter a valid company name.')
      setStep(1)
      return
    }

    // Pick a unique slug by probing the backend — simple collision
    // handling so the user never has to think about it. First try the
    // plain slugified name; on conflict, append a short random suffix
    // and retry up to a handful of times.
    let slug = baseSlug
    let attempts = 0
    while (attempts < 5) {
      try {
        await orgsApi.getBySlug(slug)
        // 200 — slug is taken. Try again with a fresh suffix.
        slug = withRandomSuffix(baseSlug)
        attempts += 1
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        if (status === 404) break // slug is free
        // Any other error: abort and let the backend reject signup with
        // the real reason rather than silently continuing.
        break
      }
    }

    try {
      await orgsApi.signup({
        orgName: trimmedOrgName,
        slug,
        ownerName: values.ownerName.trim(),
        ownerEmail: values.ownerEmail.trim().toLowerCase(),
        password: values.password,
        // Strip trailing dashes the user may have typed; backend
        // re-normalizes anyway, but keeping the wire payload tidy
        // makes the server-side error path easier to read.
        employeeIdPrefix: values.employeeIdPrefix?.trim().replace(/-+$/, '') || undefined,
        timezone: detectTimezone(),
        captchaToken: captchaToken ?? undefined,
      })
      router.replace('/login?first_login=1')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      setServerError(msg)
      // Reset captcha so the user can retry — one-shot tokens expire on
      // a failed signup.
      setCaptchaToken(null)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <Input
            label="Company name"
            type="text"
            placeholder="Acme Inc"
            autoFocus
            leftIcon={<Building2 />}
            error={errors.orgName?.message}
            {...register('orgName', {
              required: 'Company name is required',
              maxLength: { value: 100, message: 'Max 100 characters' },
            })}
          />

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            onClick={goNext}
            className="w-full"
            size="lg"
            disabled={!orgName?.trim()}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <Input
            label="Your name"
            type="text"
            placeholder="Jane Doe"
            autoFocus
            leftIcon={<UserIcon />}
            error={errors.ownerName?.message}
            {...register('ownerName', { required: 'Your name is required' })}
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@acme.com"
            leftIcon={<Mail />}
            error={errors.ownerEmail?.message}
            {...register('ownerEmail', {
              required: 'Email is required',
              pattern: { value: /.+@.+\..+/, message: 'Invalid email address' },
            })}
          />

          <Input
            label="Employee ID prefix"
            type="text"
            placeholder="ACME"
            leftIcon={<IdCard />}
            // Helper text appears below the input. Length limit (8)
            // matches the backend validation; auto-uppercased on the
            // wire but we don't force it client-side so the user
            // can type naturally.
            hint='Used in every employee ID — e.g. ACME-26AB12. Letters/numbers, up to 8 characters.'
            error={errors.employeeIdPrefix?.message}
            {...register('employeeIdPrefix', {
              required: 'Employee ID prefix is required',
              pattern: {
                value: /^[A-Za-z0-9]{1,8}$/,
                message: '1-8 letters or numbers, no spaces or symbols',
              },
            })}
          />

          <div className="flex flex-col gap-1.5">
            <PasswordInput
              label="Password"
              placeholder="Create a password"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
                validate: {
                  upper: (v) =>
                    /[A-Z]/.test(v) || 'Must contain an uppercase letter',
                  lower: (v) =>
                    /[a-z]/.test(v) || 'Must contain a lowercase letter',
                  digit: (v) => /[0-9]/.test(v) || 'Must contain a number',
                },
              })}
            />
            <PasswordStrength strength={strength} />
          </div>

          <PasswordInput
            label="Re-enter password"
            placeholder="Confirm your password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) =>
                v === password || 'Passwords do not match',
            })}
          />

          {captchaEnabled && (
            <HCaptchaWidget
              onVerify={(t) => setCaptchaToken(t)}
              onExpire={() => setCaptchaToken(null)}
            />
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setStep(1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="flex-1"
              size="lg"
              disabled={captchaEnabled && !captchaToken}
            >
              Create workspace
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            By continuing you agree to our terms and privacy policy.
          </p>
        </div>
      )}
    </form>
  )
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const labels = ['Workspace', 'Your account']
  return (
    <div className="flex items-center gap-3">
      {labels.map((label, i) => {
        const index = (i + 1) as 1 | 2
        const active = step === index
        const done = step > index
        return (
          <div key={label} className="flex flex-1 items-center gap-3">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                    ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index}
            </div>
            <span
              className={`truncate text-xs font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                className={`h-px flex-1 ${done ? 'bg-primary' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  checks: { label: string; pass: boolean }[]
}

function usePasswordStrength(password: string): Strength {
  return useMemo(() => {
    const checks = [
      { label: '8+ characters', pass: password.length >= 8 },
      { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
      { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
      { label: 'Number', pass: /[0-9]/.test(password) },
    ]
    const score = checks.filter((c) => c.pass).length as 0 | 1 | 2 | 3 | 4
    return { score, checks }
  }, [password])
}

function PasswordStrength({ strength }: { strength: Strength }) {
  const { score, checks } = strength
  const colors = [
    'bg-muted',
    'bg-destructive',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-emerald-500',
  ]
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                score >= i ? colors[score] : 'bg-muted'
              }`}
            />
          ))}
        </div>
        {score > 0 && (
          <span className="text-[11px] font-semibold text-muted-foreground">
            {labels[score]}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 text-[11px] ${c.pass ? 'text-emerald-600' : 'text-muted-foreground'}`}
          >
            <Check
              className={`h-3 w-3 transition-opacity ${c.pass ? 'opacity-100' : 'opacity-30'}`}
            />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
