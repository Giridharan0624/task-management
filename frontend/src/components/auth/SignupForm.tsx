'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { orgsApi } from '@/lib/api/orgsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { WorkspaceField } from '@/components/tenant/WorkspaceField'

interface SignupFormValues {
  orgName: string
  ownerName: string
  ownerEmail: string
  password: string
}

export function SignupForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>()

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null)
    const normalizedSlug = slug.trim().toLowerCase()
    if (!normalizedSlug) {
      setServerError('Workspace code is required')
      return
    }

    try {
      const result = await orgsApi.signup({
        orgName: values.orgName.trim(),
        slug: normalizedSlug,
        ownerName: values.ownerName.trim(),
        ownerEmail: values.ownerEmail.trim().toLowerCase(),
        password: values.password,
      })
      router.replace(`/login?workspace=${result.slug}&first_login=1`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      setServerError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Company name"
        type="text"
        placeholder="Acme Inc"
        autoFocus
        error={errors.orgName?.message}
        {...register('orgName', {
          required: 'Company name is required',
          maxLength: { value: 100, message: 'Max 100 characters' },
        })}
      />

      <WorkspaceField value={slug} onChange={setSlug} mode="signup" />

      <Input
        label="Your name"
        type="text"
        placeholder="Jane Doe"
        error={errors.ownerName?.message}
        {...register('ownerName', { required: 'Your name is required' })}
      />

      <Input
        label="Email"
        type="email"
        placeholder="you@acme.com"
        error={errors.ownerEmail?.message}
        {...register('ownerEmail', {
          required: 'Email is required',
          pattern: { value: /.+@.+\..+/, message: 'Invalid email address' },
        })}
      />

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

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        loading={isSubmitting}
        className="w-full"
        size="lg"
      >
        Create workspace
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
    </form>
  )
}
