'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'

import { orgsApi } from '@/lib/api/orgsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Logo } from '@/components/ui/Logo'
import { Card } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'

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
  } = useForm<FormValues>({ mode: 'onTouched' })

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
      const msg =
        err instanceof Error ? err.message : 'Failed to accept invitation'
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
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex justify-center">
            <Logo size="lg" hideSubline />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Accept your invitation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set your name and password to join your team.
            </p>
          </div>

          <Card className="p-6 shadow-card">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
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

              <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <p className="mb-1 font-semibold text-muted-foreground">
                  Password requirements
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
                Join the team
              </Button>
            </form>
          </Card>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Invited by your team admin.
          </p>
        </div>
      </div>
    </div>
  )
}
