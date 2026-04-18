'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

import { orgsApi } from '@/lib/api/orgsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Logo } from '@/components/ui/Logo'

interface FormValues {
  name: string
  password: string
  confirmPassword: string
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>()

  const password = watch('password', '')

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    if (values.password !== values.confirmPassword) {
      setServerError('Passwords do not match.')
      return
    }
    try {
      const result = await orgsApi.acceptInvite(token, {
        name: values.name.trim(),
        password: values.password,
      })
      router.replace(result.redirectUrl)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation'
      setServerError(msg)
    }
  }

  const checks = [
    { met: password.length >= 8, label: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), label: '1 uppercase letter' },
    { met: /[a-z]/.test(password), label: '1 lowercase letter' },
    { met: /[0-9]/.test(password), label: '1 number' },
  ]

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0f1117]">
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Accept your invitation
            </h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              Set your name and password to join your team.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1a1c25] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2d3a]">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <Input
                label="Your name"
                type="text"
                placeholder="Jane Doe"
                autoFocus
                error={errors.name?.message}
                {...register('name', { required: 'Your name is required' })}
              />

              <PasswordInput
                label="Password"
                placeholder="Create a password"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'At least 8 characters' },
                })}
              />

              <PasswordInput
                label="Confirm password"
                placeholder="Re-enter your password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                })}
              />

              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-gray-500">Password requirements</p>
                {checks.map(({ met, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={met ? 'text-emerald-500' : 'text-gray-300'}>
                      {met ? '✓' : '○'}
                    </span>
                    <span className={met ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {serverError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full mt-1"
                size="lg"
              >
                Join the team
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-[10px] text-gray-400 dark:text-gray-500">
            Powered by{' '}
            <span className="font-semibold text-gray-500 dark:text-gray-400">
              NEUROSTACK
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
