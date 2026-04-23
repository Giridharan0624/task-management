'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, FileDown, RotateCcw } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'

/**
 * OWNER-only danger-zone page. Handles all three deletion-lifecycle
 * actions:
 *   1. **Export** — generates a JSON dump (presigned S3 URL, 24h TTL)
 *      and opens it in a new tab. Users can grab their data before
 *      committing, or again after they've entered the grace period.
 *   2. **Delete** — schedules the workspace for hard-delete in 30 days.
 *      Typed-slug confirmation (typo guard). Keeps read access +
 *      a visible "Recover" affordance during the grace window.
 *   3. **Recover** — clears the pending flag. Only visible when the
 *      workspace is already in PENDING_DELETION state.
 */
export default function DeleteWorkspacePage() {
  const { user } = useAuth()
  const { current, refreshCurrent } = useTenant()
  const router = useRouter()
  const toast = useToast()

  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState<string | null>(null)

  if (!user || user.systemRole !== 'OWNER' || !current?.org) {
    return null
  }

  const org = current.org
  const slug = org.slug
  const pendingDeletion = org.status === 'PENDING_DELETION'
  const deletedAt = org.deletedAt ? new Date(org.deletedAt) : null
  const purgeAt = deletedAt
    ? new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null
  const daysRemaining = purgeAt
    ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null

  const canDelete =
    !pendingDeletion && confirmInput.trim().toLowerCase() === slug.toLowerCase()

  const onExport = async () => {
    setExportError(null)
    setExporting(true)
    try {
      const res = await orgsApi.exportWorkspace()
      // Open the presigned URL directly — triggers download in
      // most browsers. If the browser blocks auto-open, the user
      // can still click the manual link in the toast.
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer')
      toast.success(
        `Export ready: ${res.itemCount} items (${Math.round(res.sizeBytes / 1024)} KB). Link valid for 24 hours.`,
      )
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : 'Export failed. Please retry.',
      )
    } finally {
      setExporting(false)
    }
  }

  const onDelete = async () => {
    if (!canDelete) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await orgsApi.deleteWorkspace(slug)
      await refreshCurrent()
      toast.success(
        `Workspace scheduled for deletion. You have 30 days to recover.`,
      )
      setConfirmInput('')
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : 'Delete failed. Please retry.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const onRecover = async () => {
    setRecoverError(null)
    setRecovering(true)
    try {
      await orgsApi.undeleteWorkspace()
      await refreshCurrent()
      toast.success('Workspace recovered.')
      router.replace('/dashboard')
    } catch (e) {
      setRecoverError(
        e instanceof Error ? e.message : 'Recovery failed. Please retry.',
      )
      setRecovering(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Delete workspace"
        description="Permanently remove this workspace and all its data."
        breadcrumbs={[
          { label: 'Settings', href: '/settings/organization' },
          { label: 'Delete workspace' },
        ]}
      />

      {pendingDeletion && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong className="font-semibold">
              Deletion scheduled.
            </strong>{' '}
            This workspace will be permanently deleted on{' '}
            <strong>{purgeAt?.toLocaleDateString()}</strong> (
            {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left).
            All writes are blocked. You can still export data or
            recover the workspace below.
          </AlertDescription>
        </Alert>
      )}

      {/* Export — always available, even after deletion is scheduled */}
      <Card className="space-y-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Export workspace data
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Get a JSON dump of every project, task, user, audit event,
            and configuration record in this workspace. Link expires in
            24 hours.
          </p>
        </div>
        {exportError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        )}
        <Button
          variant="secondary"
          onClick={onExport}
          loading={exporting}
          className="w-full sm:w-auto"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export as JSON
        </Button>
      </Card>

      {/* Recovery — only when pending */}
      {pendingDeletion && (
        <Card className="space-y-3 border-primary/30 bg-primary/[0.03] p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Recover workspace
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cancel the scheduled deletion and restore full access
              immediately. Available during the 30-day grace period.
            </p>
          </div>
          {recoverError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{recoverError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={onRecover} loading={recovering}>
            <RotateCcw className="h-3.5 w-3.5" />
            Recover workspace
          </Button>
        </Card>
      )}

      {/* Delete — hidden once pending */}
      {!pendingDeletion && (
        <Card className="space-y-4 border-destructive/30 bg-destructive/[0.03] p-5">
          <div>
            <h2 className="text-base font-semibold text-destructive">
              Delete workspace
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Schedules the workspace for permanent deletion. A 30-day
              grace period lets you recover if you change your mind.
              After that, all data is{' '}
              <strong className="text-foreground">unrecoverable</strong>.
            </p>
          </div>

          <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3 text-xs">
            <p className="font-semibold text-destructive">
              What will be deleted after 30 days
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-4 text-muted-foreground">
              <li>• All projects, tasks, and comments</li>
              <li>• All user accounts (both DynamoDB records and Cognito users)</li>
              <li>• Attendance history, day-off requests, task updates, activity data</li>
              <li>
                • Settings, roles, pipelines, plan, audit log, and the{' '}
                <code className="rounded bg-muted/60 px-1">{slug}</code> workspace code
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Export your data first if you might want it later.
            </p>
          </div>

          <div>
            <Input
              label={`Type "${slug}" to confirm`}
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={slug}
              hint={
                confirmInput.trim() === ''
                  ? 'The workspace code is the typo guard.'
                  : canDelete
                    ? 'Confirmed. You can schedule deletion below.'
                    : 'Must match exactly.'
              }
            />
          </div>

          {deleteError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="danger"
            onClick={onDelete}
            disabled={!canDelete}
            loading={deleting}
            className="w-full sm:w-auto"
          >
            Schedule deletion
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}
    </div>
  )
}
