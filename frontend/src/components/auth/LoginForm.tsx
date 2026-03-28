'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth/AuthProvider'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginForm() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>()

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      setServerError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Email or Employee ID"
        type="text"
        autoComplete="username"
        placeholder="you@example.com or EMP-0001"
        error={errors.email?.message}
        {...register('email', {
          required: 'Email or Employee ID is required',
        })}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Password must be at least 8 characters' },
        })}
      />

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        Sign in
      </Button>
    </form>
  )
}
