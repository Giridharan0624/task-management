'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Upload,
  X,
  XCircle,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  bulkCreateUsers,
  type BulkCreateResult,
  type BulkUserRow,
} from '@/lib/api/userApi'
import { cn } from '@/lib/utils'

/**
 * Bulk-import users from CSV.
 *
 * Three phases:
 *  1. Upload — drag-or-pick a .csv file. Parsed client-side so the
 *     admin sees errors before submitting. Up to 200 rows per request
 *     (backend cap); larger lists need to be chunked.
 *  2. Preview — table with per-row validation (email format + role
 *     whitelist). Any invalid row blocks submission.
 *  3. Result — backend returns per-row success/failure. Successful
 *     rows show their generated employee ID; failed rows show the
 *     exact error so the admin can fix and retry that row alone.
 *
 * Expected CSV header (case-insensitive, order-agnostic):
 *     email, name, role, department, date_of_joining
 *
 * `role` defaults to MEMBER if omitted. `date_of_joining` is optional.
 */

const MAX_ROWS = 200
const VALID_ROLES: ReadonlyArray<BulkUserRow['systemRole']> = [
  'ADMIN',
  'MEMBER',
]

interface ParsedRow extends BulkUserRow {
  /** 1-indexed for user-facing display. */
  rowNum: number
  error?: string
}

interface BulkImportUsersModalProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function BulkImportUsersModal({
  open,
  onClose,
  onComplete,
}: BulkImportUsersModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BulkCreateResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const invalidCount = useMemo(
    () => rows.filter((r) => r.error).length,
    [rows],
  )
  const canSubmit = rows.length > 0 && invalidCount === 0 && !submitting

  const handleReset = useCallback(() => {
    setFile(null)
    setRows([])
    setParseError(null)
    setResult(null)
    setSubmitting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    handleReset()
    onClose()
  }, [handleReset, onClose])

  const handleParse = useCallback(async (f: File) => {
    setFile(f)
    setParseError(null)
    setResult(null)
    try {
      const text = await f.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        setParseError('No data rows found in the CSV.')
        setRows([])
        return
      }
      if (parsed.length > MAX_ROWS) {
        setParseError(
          `Too many rows (${parsed.length}). Max ${MAX_ROWS} per import — split the file and retry.`,
        )
        setRows([])
        return
      }
      setRows(parsed)
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : 'Could not parse the CSV file.',
      )
      setRows([])
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      // Strip internal `rowNum` + `error` before posting — backend
      // only expects the raw user fields.
      const payload: BulkUserRow[] = rows.map((r) => ({
        email: r.email,
        name: r.name,
        systemRole: r.systemRole,
        department: r.department,
        dateOfJoining: r.dateOfJoining,
      }))
      const res = await bulkCreateUsers(payload)
      setResult(res)
      // If at least one user was created, refresh the parent list.
      if (res.summary.created > 0) onComplete()
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : 'Import failed. Please retry.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [rows, onComplete])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import users from CSV</DialogTitle>
        </DialogHeader>

        {/* Phase 3: post-submit result */}
        {result ? (
          <ImportResult
            result={result}
            onClose={handleClose}
            onImportMore={handleReset}
          />
        ) : rows.length > 0 ? (
          /* Phase 2: preview */
          <PreviewPhase
            rows={rows}
            invalidCount={invalidCount}
            canSubmit={canSubmit}
            submitting={submitting}
            onReset={handleReset}
            onSubmit={handleSubmit}
          />
        ) : (
          /* Phase 1: upload */
          <UploadPhase
            fileInputRef={fileInputRef}
            file={file}
            parseError={parseError}
            onFileChosen={handleParse}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ──────────────────────────────────────────────────────────────────────

function UploadPhase({
  fileInputRef,
  file,
  parseError,
  onFileChosen,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>
  file: File | null
  parseError: string | null
  onFileChosen: (f: File) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">Expected columns</p>
        <code className="block rounded bg-background px-2 py-1.5 font-mono text-[11px]">
          email, name, role, department, date_of_joining
        </code>
        <p className="mt-2">
          <strong className="text-foreground">role</strong> accepts{' '}
          <code>ADMIN</code> or <code>MEMBER</code> (defaults to MEMBER).{' '}
          <strong className="text-foreground">date_of_joining</strong> is
          optional (ISO date like <code>2026-01-15</code>). Max{' '}
          {MAX_ROWS} rows per import.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={downloadTemplate}
          className="mt-2 h-7 gap-1.5 px-0 text-xs text-primary hover:underline"
        >
          <FileDown className="h-3 w-3" />
          Download template
        </Button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFileChosen(f)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-background hover:border-primary/40',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {file ? file.name : 'Drop your CSV here, or click to pick a file'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            .csv up to 2 MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFileChosen(f)
          }}
          className="sr-only"
        />
      </label>

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function PreviewPhase({
  rows,
  invalidCount,
  canSubmit,
  submitting,
  onReset,
  onSubmit,
}: {
  rows: ParsedRow[]
  invalidCount: number
  canSubmit: boolean
  submitting: boolean
  onReset: () => void
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-3 text-sm">
          <Badge tone="primary" size="sm">
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </Badge>
          {invalidCount > 0 && (
            <Badge tone="danger" size="sm">
              {invalidCount} invalid
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-3.5 w-3.5" />
          Start over
        </Button>
      </div>

      {invalidCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Fix the {invalidCount} invalid row{invalidCount === 1 ? '' : 's'}{' '}
            below before importing. Hover the red icon for details.
          </AlertDescription>
        </Alert>
      )}

      <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Role</th>
              <th className="px-2 py-2 text-left">Department</th>
              <th className="px-2 py-2 text-left">Joined</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr
                key={r.rowNum}
                className={cn(r.error && 'bg-destructive/5')}
              >
                <td className="px-2 py-1.5 font-mono text-muted-foreground">
                  {r.rowNum}
                </td>
                <td className="px-2 py-1.5 font-mono">{r.email}</td>
                <td className="px-2 py-1.5">{r.name}</td>
                <td className="px-2 py-1.5">
                  <Badge
                    tone={r.systemRole === 'ADMIN' ? 'primary' : 'neutral'}
                    size="sm"
                  >
                    {r.systemRole}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {r.department || '—'}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {r.dateOfJoining || '—'}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {r.error ? (
                    <span title={r.error}>
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    </span>
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onReset} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit} loading={submitting}>
          <Upload className="h-3.5 w-3.5" />
          Import {rows.length} user{rows.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}

function ImportResult({
  result,
  onClose,
  onImportMore,
}: {
  result: BulkCreateResult
  onClose: () => void
  onImportMore: () => void
}) {
  const { created, failed, summary } = result
  const allSucceeded = failed.length === 0
  return (
    <div className="flex flex-col gap-4">
      <Alert
        className={cn(
          allSucceeded
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
        )}
      >
        {allSucceeded ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertDescription>
          Created <strong>{summary.created}</strong> of{' '}
          <strong>{summary.requested}</strong> user
          {summary.requested === 1 ? '' : 's'}.
          {failed.length > 0 && (
            <>
              {' '}
              <strong>{failed.length}</strong> row
              {failed.length === 1 ? '' : 's'} failed — see below.
            </>
          )}
        </AlertDescription>
      </Alert>

      {created.length > 0 && (
        <ResultSection title="Created" tone="success">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-1.5 text-left">#</th>
                <th className="px-2 py-1.5 text-left">Email</th>
                <th className="px-2 py-1.5 text-left">Employee ID</th>
                <th className="px-2 py-1.5 text-left">Temp password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {created.map((c) => (
                <tr key={c.userId}>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">
                    {c.row}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{c.email}</td>
                  <td className="px-2 py-1.5 font-mono">{c.employeeId}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{c.otp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            Welcome emails were sent with these codes. Share manually if a
            user says they didn&apos;t receive theirs.
          </p>
        </ResultSection>
      )}

      {failed.length > 0 && (
        <ResultSection title="Failed" tone="error">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-1.5 text-left">#</th>
                <th className="px-2 py-1.5 text-left">Email</th>
                <th className="px-2 py-1.5 text-left">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {failed.map((f) => (
                <tr key={`${f.row}-${f.email}`}>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">
                    {f.row}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{f.email}</td>
                  <td className="px-2 py-1.5 text-destructive">{f.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultSection>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onImportMore}>
          Import more
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

function ResultSection({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'success' | 'error'
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className={cn(
          'border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
          tone === 'success'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-destructive/10 text-destructive',
        )}
      >
        {title}
      </div>
      <div className="max-h-[240px] overflow-y-auto">{children}</div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// CSV parsing (minimal — handles quoted fields + escaped quotes)
// ──────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const colIdx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i !== -1) return i
    }
    return -1
  }
  const iEmail = colIdx(['email'])
  const iName = colIdx(['name'])
  const iRole = colIdx(['role', 'system_role', 'systemrole'])
  const iDept = colIdx(['department', 'dept'])
  const iJoined = colIdx([
    'date_of_joining',
    'dateofjoining',
    'joined',
    'joining_date',
  ])

  if (iEmail === -1 || iName === -1) {
    throw new Error(
      'CSV must include at least "email" and "name" columns in the header.',
    )
  }

  const out: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const email = (cells[iEmail] ?? '').trim().toLowerCase()
    const name = (cells[iName] ?? '').trim()
    const rawRole =
      iRole >= 0
        ? (cells[iRole] ?? '').trim().toUpperCase() || 'MEMBER'
        : 'MEMBER'
    const systemRole = VALID_ROLES.includes(rawRole as BulkUserRow['systemRole'])
      ? (rawRole as BulkUserRow['systemRole'])
      : 'MEMBER'
    const department = iDept >= 0 ? (cells[iDept] ?? '').trim() : ''
    const dateOfJoining = iJoined >= 0 ? (cells[iJoined] ?? '').trim() : ''

    let error: string | undefined
    if (!email) error = 'Email is required'
    else if (!EMAIL_RE.test(email)) error = 'Invalid email format'
    else if (!name) error = 'Name is required'
    else if (iRole >= 0 && !VALID_ROLES.includes(rawRole as BulkUserRow['systemRole'])) {
      error = `Role "${rawRole}" not valid (use ADMIN or MEMBER)`
    }

    out.push({
      rowNum: i + 1, // header is row 1, so data starts at 2
      email,
      name,
      systemRole,
      department,
      dateOfJoining,
      error,
    })
  }
  return out
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuote = true
    } else if (c === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(cur)
  return cells
}

function downloadTemplate() {
  const csv =
    'email,name,role,department,date_of_joining\n' +
    'alice@example.com,Alice Smith,MEMBER,Engineering,2026-01-15\n' +
    'bob@example.com,Bob Jones,ADMIN,Operations,\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'taskflow-users-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
