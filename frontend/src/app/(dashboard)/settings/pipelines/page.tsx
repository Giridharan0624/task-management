'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KanbanSquare,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import type { Pipeline, PipelineStatus } from '@/types/org'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { BackToSettings } from '@/components/settings/BackToSettings'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

type EditablePipeline = Pipeline | null

export default function PipelinesSettingsPage() {
  const { user } = useAuth()
  const { current, refreshCurrent } = useTenant()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<EditablePipeline>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (user && user.systemRole !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [user, router])

  const pipelines = current?.pipelines ?? []

  const refresh = async () => {
    await refreshCurrent()
  }

  const handleDelete = async (p: Pipeline) => {
    if (p.isDefault) {
      toast.error('Cannot delete the default pipeline. Promote another first.')
      return
    }
    const ok = await confirm({
      title: `Delete '${p.name}'?`,
      description:
        'Tasks that still reference this pipeline will prevent deletion. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await orgsApi.deletePipeline(p.pipelineId)
      toast.success(`Pipeline '${p.name}' deleted`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const handleSetDefault = async (p: Pipeline) => {
    if (p.isDefault) return
    try {
      await orgsApi.updatePipeline(p.pipelineId, { isDefault: true })
      toast.success(`'${p.name}' is now the default pipeline`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24 animate-fade-in">
      <BackToSettings />
      <PageHeader
        title="Task pipelines"
        description="Workflows your tasks move through. Customize columns, colors, and statuses for each domain of work."
      />

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New pipeline
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <KanbanSquare className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">No pipelines yet</p>
          <p className="text-xs text-muted-foreground">
            Create your first pipeline — or log in again to refresh the
            default seed.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-rise">
          {pipelines.map((p) => (
            <PipelineCard
              key={p.pipelineId}
              pipeline={p}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
              onSetDefault={() => handleSetDefault(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <PipelineEditorModal
          pipeline={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}

      {creating && (
        <PipelineEditorModal
          pipeline={null}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function PipelineCard({
  pipeline,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  pipeline: Pipeline
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  return (
    <Card className="group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover-lift-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{pipeline.name}</h3>
            {pipeline.isDefault && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]"
              >
                <Star className="mr-1 h-2.5 w-2.5" />
                Default
              </Badge>
            )}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            id: {pipeline.pipelineId}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {pipeline.statuses.length} status
          {pipeline.statuses.length === 1 ? '' : 'es'}
        </p>
      </div>

      {/* Visual status flow */}
      <div className="flex flex-wrap items-center gap-1">
        {pipeline.statuses.map((s, i) => (
          <span key={s.id} className="inline-flex items-center">
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1"
              style={{
                backgroundColor: `${s.color}18`,
                color: s.color,
                boxShadow: `inset 0 0 0 1px ${s.color}40`,
              }}
            >
              {s.label}
            </span>
            {i < pipeline.statuses.length - 1 && (
              <span className="mx-1 text-muted-foreground/40">→</span>
            )}
          </span>
        ))}
      </div>

      <div className="mt-auto flex gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">
          Edit
        </Button>
        {!pipeline.isDefault && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetDefault}
              title="Make default"
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Delete pipeline"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

interface StatusDraft {
  id: string
  label: string
  color: string
  isTerminal: boolean
}

function PipelineEditorModal({
  pipeline,
  onClose,
  onSaved,
}: {
  pipeline: Pipeline | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const isCreating = pipeline === null

  const [name, setName] = useState(pipeline?.name ?? '')
  const [statuses, setStatuses] = useState<StatusDraft[]>(
    pipeline
      ? pipeline.statuses.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          isTerminal: s.isTerminal,
        }))
      : [
          { id: 'TODO', label: 'To do', color: '#F59E0B', isTerminal: false },
          { id: 'IN_PROGRESS', label: 'In progress', color: '#3B82F6', isTerminal: false },
          { id: 'DONE', label: 'Done', color: '#10B981', isTerminal: true },
        ],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (i: number, patch: Partial<StatusDraft>) => {
    setStatuses((list) =>
      list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    )
  }

  const remove = (i: number) => {
    if (statuses.length <= 1) {
      setError('A pipeline needs at least one status.')
      return
    }
    setStatuses((list) => list.filter((_, idx) => idx !== i))
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= statuses.length) return
    setStatuses((list) => {
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const add = () => {
    setStatuses((list) => [
      ...list,
      {
        id: `STATUS_${list.length + 1}`,
        label: 'New status',
        color: '#64748B',
        isTerminal: false,
      },
    ])
  }

  const ids = useMemo(() => statuses.map((s) => s.id), [statuses])
  const duplicateId = useMemo(() => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) return id
      seen.add(id)
    }
    return null
  }, [ids])

  const onSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (statuses.length === 0) {
      setError('Add at least one status.')
      return
    }
    if (duplicateId) {
      setError(`Duplicate status id: ${duplicateId}`)
      return
    }
    for (const s of statuses) {
      if (!s.id.trim() || !s.label.trim()) {
        setError('Every status needs an id and a label.')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        statuses: statuses.map((s) => ({
          id: s.id.trim().toUpperCase(),
          label: s.label.trim(),
          color: s.color,
          isTerminal: s.isTerminal,
        })),
      }
      if (isCreating) {
        await orgsApi.createPipeline(payload)
        toast.success(`Pipeline '${name}' created`)
      } else {
        await orgsApi.updatePipeline(pipeline!.pipelineId, payload)
        toast.success(`Pipeline '${name}' saved`)
      }
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isCreating ? 'Create pipeline' : `Edit pipeline: ${pipeline?.name}`}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Input
          label="Pipeline name"
          placeholder="e.g. Sales, Marketing, Support"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground/85">
              Statuses ({statuses.length})
            </p>
            <Button variant="secondary" size="sm" onClick={add}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add status
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Order here is the order columns appear in the kanban. First status
            is the landing column; last is typically the &ldquo;done&rdquo; column.
          </p>

          <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {statuses.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === statuses.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => update(i, { color: e.target.value })}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Status color"
                />

                <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    value={s.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder="Label"
                    className={cn(
                      'h-8',
                      s.isTerminal && 'font-semibold',
                    )}
                  />
                  <Input
                    type="text"
                    value={s.id}
                    onChange={(e) =>
                      update(i, {
                        id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                      })
                    }
                    placeholder="ID"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => update(i, { isTerminal: !s.isTerminal })}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                    s.isTerminal
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70',
                  )}
                  title="Mark as terminal (done-equivalent)"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Terminal
                </button>

                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={statuses.length <= 1}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                  aria-label="Remove status"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isCreating ? 'Create pipeline' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
