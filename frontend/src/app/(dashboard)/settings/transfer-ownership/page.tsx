'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Shield } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { getUsers } from '@/lib/api/userApi'
import { orgsApi } from '@/lib/api/orgsApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import type { User } from '@/types/user'

/**
 * OWNER-only page for transferring workspace ownership.
 *
 * Three-step confirmation — picked intentionally because this action is
 * irreversible without the new owner's cooperation:
 *   1. Pick the target user from the active members list.
 *   2. Type the new owner's email exactly (typo guard — backend also
 *      re-validates this).
 *   3. Click the red button. Success demotes the current OWNER to ADMIN
 *      and promotes the target; the page then forces a token refresh so
 *      the sidebar re-renders against the new role.
 */
export default function TransferOwnershipPage() {
  const { user, refreshSession, signOut } = useAuth()
  const { current, refreshCurrent } = useTenant()
  const router = useRouter()
  const toast = useToast()

  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string>('')
  const [confirmEmail, setConfirmEmail] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (user.systemRole !== 'OWNER') {
      router.replace('/settings/organization')
      return
    }
    getUsers()
      .then((list) => setUsers(list))
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : 'Failed to load team'),
      )
  }, [user, router])

  // Eligible candidates = everyone except the current owner. We don't
  // filter further by role because a workspace might want to promote an
  // ADMIN or a MEMBER directly.
  const candidates = useMemo(() => {
    if (!users || !user) return []
    return users
      .filter((u) => u.userId !== user.userId)
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
  }, [users, user])

  const targetUser = candidates.find((u) => u.userId === targetId) ?? null
  const emailsMatch =
    !!targetUser &&
    confirmEmail.trim().toLowerCase() === targetUser.email.trim().toLowerCase()
  const canSubmit = !!targetUser && emailsMatch && !submitting

  const onTransfer = async () => {
    if (!targetUser) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await orgsApi.transferOwnership({
        newOwnerUserId: targetUser.userId,
        confirmEmail: targetUser.email,
      })
      // Force a token refresh so the JWT's custom:systemRole reflects
      // ADMIN for the now-ex-owner. Without this the sidebar still
      // renders the owner nav until the user logs out and back in.
      try {
        await refreshSession()
      } catch {
        // If refresh fails (rare — token grace), push them to sign-in
        // rather than leave them with a stale OWNER view.
        signOut()
        return
      }
      await refreshCurrent()
      toast.success(
        `Ownership transferred to ${targetUser.name || targetUser.email}.`,
      )
      router.replace('/dashboard')
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Transfer failed. Please try again.',
      )
      setSubmitting(false)
    }
  }

  if (!user || user.systemRole !== 'OWNER') return null

  const orgName = current?.org?.name ?? 'this workspace'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Transfer ownership"
        description={`Move ownership of ${orgName} to another member.`}
      />

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong className="font-semibold">This action is irreversible</strong>{' '}
          without the new owner&apos;s cooperation. You will be demoted to
          ADMIN immediately after the transfer completes.
        </AlertDescription>
      </Alert>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="space-y-5 p-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">
            New owner
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Select an existing member of your workspace. They will be
            promoted to OWNER immediately.
          </p>
          {users === null ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Spinner size="sm" />
              Loading team members...
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No other members in this workspace yet. Invite someone first
              before transferring ownership.
            </div>
          ) : (
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value)
                setConfirmEmail('')
                setSubmitError(null)
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Select a member —</option>
              {candidates.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name || u.email} ({u.email}) — {u.systemRole}
                </option>
              ))}
            </select>
          )}
        </div>

        {targetUser && (
          <>
            <div>
              <Input
                label="Confirm new owner's email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={targetUser.email}
                hint={
                  emailsMatch
                    ? 'Email matches — ready to transfer.'
                    : "Type the new owner's email exactly to enable transfer."
                }
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                <Shield className="h-3.5 w-3.5" />
                What happens on transfer
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  •{' '}
                  <strong className="text-foreground">
                    {targetUser.name || targetUser.email}
                  </strong>{' '}
                  becomes OWNER and gains full workspace control.
                </li>
                <li>
                  • You ({user.email}) are demoted to ADMIN immediately.
                </li>
                <li>
                  • The action is recorded in the audit log under{' '}
                  <code className="rounded bg-muted/60 px-1 py-0.5">
                    org.ownership_transferred
                  </code>
                  .
                </li>
              </ul>
            </div>
          </>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push('/settings/organization')}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onTransfer}
            loading={submitting}
            disabled={!canSubmit}
          >
            Transfer ownership
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
