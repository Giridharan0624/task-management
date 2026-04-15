'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'

import { orgsApi } from '@/lib/api/orgsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
            upper: (v) => /[A-Z]/.test(v) || 'Must contain an uppercase letter',
            lower: (v) => /[a-z]/.test(v) || 'Must contain a lowercase letter',
            digit: (v) => /[0-9]/.test(v) || 'Must contain a number',
          },
        })}
      />

      {serverError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg
            className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {serverError}
        </div>
      )}

      <Button
        type="submit"
        loading={isSubmitting}
        className="w-full mt-1"
        size="lg"
      >
        Create workspace
      </Button>

      <p className="text-xs text-center text-gray-500">
        Already have an account?{' '}
        <a
          href="/login"
          className="text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          Sign in
        </a>
      </p>
    </form>
  )
}
