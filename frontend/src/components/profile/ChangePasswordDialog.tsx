'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useAuth } from '@/lib/auth/AuthProvider'

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

type Mode = 'change' | 'forgot' | 'confirm' | 'success'

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { changePassword, user } = useAuth()

  const [mode, setMode] = useState<Mode>('change')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPw, setForgotNewPw] = useState('')
  const [forgotConfirmPw, setForgotConfirmPw] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const reset = () => {
    setMode('change')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setForgotCode('')
    setForgotNewPw('')
    setForgotConfirmPw('')
    setError('')
    setSaving(false)
    setForgotLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleChange = async () => {
    setError('')
    if (!currentPw || !newPw || !confirmPw) {
      setError('All fields are required')
      return
    }
    if (newPw.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match')
      return
    }
    if (currentPw === newPw) {
      setError('New password must be different from the current password')
      return
    }

    setSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setMode('success')
      setTimeout(handleClose, 1800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password'
      if (msg.includes('Incorrect')) setError('Current password is incorrect')
      else if (msg.includes('policy') || msg.includes('Password'))
        setError('Password must have 8+ characters with uppercase, lowercase, and a number')
      else setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSendCode = async () => {
    if (!user?.email) return
    setError('')
    setForgotLoading(true)
    try {
      const { forgotPassword } = await import('@/lib/auth/cognitoClient')
      await forgotPassword(user.email)
      setMode('confirm')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleConfirmReset = async () => {
    setError('')
    if (!forgotCode.trim()) {
      setError('Code is required')
      return
    }
    if (forgotNewPw.length < 8) {
      setError('At least 8 characters')
      return
    }
    if (!/[A-Z]/.test(forgotNewPw)) {
      setError('Need an uppercase letter')
      return
    }
    if (!/[a-z]/.test(forgotNewPw)) {
      setError('Need a lowercase letter')
      return
    }
    if (!/[0-9]/.test(forgotNewPw)) {
      setError('Need a number')
      return
    }
    if (forgotNewPw !== forgotConfirmPw) {
      setError('Passwords do not match')
      return
    }

    setForgotLoading(true)
    try {
      const { confirmForgotPassword } = await import('@/lib/auth/cognitoClient')
      await confirmForgotPassword(user!.email, forgotCode.trim(), forgotNewPw)
      setMode('success')
      setTimeout(handleClose, 1800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset'
      if (msg.includes('CodeMismatch') || msg.includes('code'))
        setError('Invalid code')
      else if (msg.includes('Expired'))
        setError('Code expired. Request a new one.')
      else setError(msg)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'success'
              ? 'Password updated'
              : mode === 'change'
                ? 'Change password'
                : 'Reset password'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'success'
              ? 'Use your new password for the next sign-in.'
              : mode === 'change'
                ? 'Enter your current password and pick a new one.'
                : `A verification code has been sent to ${user?.email}.`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'success' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              You may be asked to sign in again with your new password.
            </p>
          </div>
        )}

        {mode !== 'success' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {mode === 'change' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">
                  Current password
                </label>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={forgotLoading}
                  className="h-auto"
                >
                  {forgotLoading ? 'Sending...' : 'Forgot?'}
                </Button>
              </div>
              <PasswordInput
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <PasswordInput
              label="New password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Enter new password"
            />
            <PasswordInput
              label="Confirm new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
            />
            <p className="text-[11px] text-muted-foreground">
              Min 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>
        )}

        {mode === 'confirm' && (
          <div className="flex flex-col gap-4">
            <Input
              label="Verification code"
              type="text"
              placeholder="Enter 6-digit code"
              value={forgotCode}
              onChange={(e) => setForgotCode(e.target.value)}
              autoComplete="one-time-code"
            />
            <PasswordInput
              label="New password"
              value={forgotNewPw}
              onChange={(e) => setForgotNewPw(e.target.value)}
              placeholder="Enter new password"
            />
            <PasswordInput
              label="Confirm password"
              value={forgotConfirmPw}
              onChange={(e) => setForgotConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
            />
            <p className="text-[11px] text-muted-foreground">
              Min 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>
        )}

        {mode !== 'success' && (
          <DialogFooter>
            {mode === 'confirm' && (
              <Button
                variant="secondary"
                onClick={() => {
                  setMode('change')
                  setError('')
                }}
              >
                Back
              </Button>
            )}
            {mode === 'change' && (
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={mode === 'change' ? handleChange : handleConfirmReset}
              loading={mode === 'change' ? saving : forgotLoading}
            >
              {mode === 'change' ? 'Change password' : 'Reset password'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
