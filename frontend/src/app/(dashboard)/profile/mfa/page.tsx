'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import {
  associateTotp,
  disableTotp,
  isTotpEnabled,
  verifyTotpEnrollment,
} from '@/lib/auth/cognitoClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

/**
 * TOTP 2FA enrollment + management.
 *
 * Three states, driven by `enabled` from Cognito's user-data
 * (GetUser returns PreferredMfaSetting and UserMFASettingList):
 *   1. Unknown — loading.
 *   2. Enabled — shows a disable affordance. Disabling sets preference
 *      back to none + Cognito stops issuing the SOFTWARE_TOKEN_MFA
 *      challenge on subsequent logins.
 *   3. Disabled — shows an "Enable 2FA" flow: associate → QR +
 *      secret → verify first code → commit. `associateSoftwareToken`
 *      is idempotent; re-starting the flow just re-fetches the
 *      current secret. Enrollment doesn't take effect until
 *      `verifyTotpEnrollment` lands.
 *
 * Recovery: there's no backup-code mechanism in v1. If a user loses
 * their phone, the workspace OWNER resets their MFA via the admin
 * Users page (ADMIN_RESET_USER_MFA permission — gated there).
 */
export default function MfaSettingsPage() {
  const { user } = useAuth()
  const { current } = useTenant()
  const router = useRouter()
  const toast = useToast()

  const [statusLoading, setStatusLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [secret, setSecret] = useState<string | null>(null)
  const [associating, setAssociating] = useState(false)
  const [associateError, setAssociateError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [disabling, setDisabling] = useState(false)
  const [disableError, setDisableError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const on = await isTotpEnabled()
      setEnabled(on)
    } catch (e) {
      setStatusError(
        e instanceof Error
          ? e.message
          : 'Could not read 2FA status. Please refresh.',
      )
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void loadStatus()
  }, [user, loadStatus])

  const onStartEnroll = async () => {
    setAssociateError(null)
    setAssociating(true)
    try {
      const s = await associateTotp()
      setSecret(s)
    } catch (e) {
      setAssociateError(
        e instanceof Error
          ? e.message
          : 'Could not start enrollment. Please try again.',
      )
    } finally {
      setAssociating(false)
    }
  }

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setVerifyError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setVerifyError(null)
    setVerifying(true)
    try {
      await verifyTotpEnrollment(trimmed, deviceLabel())
      toast.success('Two-factor authentication enabled.')
      setSecret(null)
      setCode('')
      setEnabled(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed.'
      if (msg.includes('CodeMismatch') || msg.toLowerCase().includes('code')) {
        setVerifyError(
          'Code did not match. Wait for the next code in your app and re-enter.',
        )
      } else {
        setVerifyError(msg)
      }
      setCode('')
      setVerifying(false)
    }
  }

  const onDisable = async () => {
    const confirmed = window.confirm(
      'Disable two-factor authentication? Your account will be protected by password only until you re-enable.',
    )
    if (!confirmed) return
    setDisableError(null)
    setDisabling(true)
    try {
      await disableTotp()
      toast.success('Two-factor authentication disabled.')
      setEnabled(false)
    } catch (e) {
      setDisableError(
        e instanceof Error ? e.message : 'Could not disable. Please retry.',
      )
    } finally {
      setDisabling(false)
    }
  }

  if (!user) return null

  const orgDisplay =
    current?.settings?.displayName || current?.org?.name || 'TaskFlow'

  const otpauthUri = secret ? buildOtpauthUri(user.email, orgDisplay, secret) : null
  const qrSrc = otpauthUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUri)}`
    : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Two-factor authentication"
        description="Add a second-step verification to protect your account."
        breadcrumbs={[
          { label: 'Profile', href: '/profile' },
          { label: 'Two-factor' },
        ]}
      />

      {statusLoading ? (
        <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Spinner size="sm" />
          Checking status...
        </Card>
      ) : statusError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      ) : enabled ? (
        /* Enabled state */
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">
                2FA is enabled
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Every sign-in requires a code from your authenticator app.
                If you lose access, your workspace owner can reset 2FA
                from the admin Users page.
              </p>
            </div>
          </div>

          {disableError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{disableError}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="secondary"
            onClick={onDisable}
            loading={disabling}
            className="border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            Disable 2FA
          </Button>
        </Card>
      ) : secret ? (
        /* Enrolling — QR + verify */
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Scan + verify
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan the QR code with Google Authenticator, Authy, 1Password,
              or any TOTP-compatible app. Then enter the 6-digit code the
              app generates to finish enrollment.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/20 p-5 sm:flex-row sm:items-start">
            {qrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt="Authenticator QR code"
                width={220}
                height={220}
                className="rounded-lg border border-border bg-white p-2"
              />
            )}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Manual entry
                </p>
                <p className="mt-1 break-all rounded bg-card px-2 py-1.5 font-mono text-[11px] text-foreground">
                  {secret}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(secret).catch(() => {})
                    toast.success('Secret copied.')
                  }}
                  className="mt-1 h-7 gap-1.5 px-0 text-xs text-primary"
                >
                  <Copy className="h-3 w-3" />
                  Copy secret
                </Button>
              </div>
            </div>
          </div>

          <form onSubmit={onVerify} className="flex flex-col gap-3">
            <Input
              label="6-digit code from your app"
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSecret(null)
                  setCode('')
                  setVerifyError(null)
                }}
                disabled={verifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={verifying}
                disabled={code.length !== 6}
                className="flex-1"
              >
                <KeyRound className="h-4 w-4" />
                Verify + enable
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        /* Disabled state — offer to enroll */
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">
                2FA is not enabled
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                We strongly recommend enabling two-factor authentication
                if you&apos;re an OWNER or ADMIN. A stolen password alone
                won&apos;t be enough to sign in.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p className="font-semibold text-foreground">
              You&apos;ll need an authenticator app
            </p>
            <p className="mt-1 text-muted-foreground">
              Google Authenticator, Authy, 1Password, Microsoft
              Authenticator — anything that supports the TOTP standard.
              Install one before starting.
            </p>
          </div>

          {associateError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{associateError}</AlertDescription>
            </Alert>
          )}

          <Button onClick={onStartEnroll} loading={associating}>
            <Shield className="h-4 w-4" />
            Enable 2FA
          </Button>
        </Card>
      )}
    </div>
  )
}

/** Build a `otpauth://` URI that any TOTP app can parse. Used to seed
 *  the QR code. RFC 6238 + Google Authenticator conventions. */
function buildOtpauthUri(
  email: string,
  issuer: string,
  secret: string,
): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const i = encodeURIComponent(issuer)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${i}&algorithm=SHA1&digits=6&period=30`
}

/** Friendly device name stamped on the enrollment. Shows up in
 *  Cognito's listDevices + console. `navigator.userAgent` is imperfect
 *  but good enough to help the user tell which device they enrolled
 *  when they inspect later. */
function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Authenticator'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS authenticator'
  if (/android/.test(ua)) return 'Android authenticator'
  if (/mac/.test(ua)) return 'macOS authenticator'
  if (/win/.test(ua)) return 'Windows authenticator'
  return 'Authenticator'
}
